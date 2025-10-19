"use client";

import { useEffect, useState, useCallback } from "react";

// Nudge types matching backend
type NudgeType = "info" | "warning" | "block";

interface Nudge {
  nudge_id: number;
  nudge_type: NudgeType;
  message: string;
  severity: string;
  display_duration?: number; // seconds (undefined for blocks)
  timestamp: number; // when received
}

interface NudgeOverlayProps {
  interviewId: number;
  adminId: string;
  onBlock?: () => void; // Callback when interview is blocked
}

export default function NudgeOverlay({
  interviewId,
  adminId,
  onBlock,
}: NudgeOverlayProps) {
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Connect to nudge WebSocket
  useEffect(() => {
    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000"}/ws/interview/${interviewId}/nudges?admin_id=${adminId}`;

    console.log(`Connecting to nudge stream: ${wsUrl}`);
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log("Nudge WebSocket connected");
      setIsConnected(true);
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle nudge delivery
        if (data.nudge_id) {
          const newNudge: Nudge = {
            ...data,
            timestamp: Date.now(),
          };

          console.log("Received nudge:", newNudge);
          setNudges((prev) => [...prev, newNudge]);

          // Auto-dismiss info nudges after duration
          if (newNudge.nudge_type === "info" && newNudge.display_duration) {
            setTimeout(() => {
              dismissNudge(newNudge.nudge_id);
            }, newNudge.display_duration * 1000);
          }

          // Trigger block callback for block nudges
          if (newNudge.nudge_type === "block" && onBlock) {
            onBlock();
          }
        }

        // Handle acknowledgment confirmation
        if (data.status === "acknowledged") {
          console.log(`Nudge ${data.nudge_id} acknowledged by server`);
        }
      } catch (error) {
        console.error("Error parsing nudge message:", error);
      }
    };

    websocket.onerror = (error) => {
      console.error("Nudge WebSocket error:", error);
      setIsConnected(false);
    };

    websocket.onclose = () => {
      console.log("Nudge WebSocket disconnected");
      setIsConnected(false);
    };

    setWs(websocket);

    // Cleanup
    return () => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
    };
  }, [interviewId, adminId, onBlock]);

  // Acknowledge nudge
  const acknowledgeNudge = useCallback(
    (nudgeId: number) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(
          JSON.stringify({
            type: "acknowledge",
            nudge_id: nudgeId,
          })
        );
      }
      dismissNudge(nudgeId);
    },
    [ws]
  );

  // Dismiss nudge from UI
  const dismissNudge = useCallback((nudgeId: number) => {
    setNudges((prev) => prev.filter((n) => n.nudge_id !== nudgeId));
  }, []);

  // Get nudge styling based on type
  const getNudgeStyles = (type: NudgeType) => {
    switch (type) {
      case "info":
        return {
          bg: "bg-gradient-to-r from-primary-500 to-primary-600",
          text: "text-white",
          icon: "💡",
          position: "bottom-4",
          zIndex: "z-40",
        };
      case "warning":
        return {
          bg: "bg-gradient-to-r from-yellow-400 to-orange-500",
          text: "text-gray-900",
          icon: "⚠️",
          position: "top-20",
          zIndex: "z-50",
        };
      case "block":
        return {
          bg: "bg-gradient-to-r from-red-600 to-red-700",
          text: "text-white",
          icon: "🛑",
          position: "top-0",
          zIndex: "z-[9999]",
        };
      default:
        return {
          bg: "bg-gray-600",
          text: "text-white",
          icon: "ℹ️",
          position: "bottom-4",
          zIndex: "z-40",
        };
    }
  };

  // Render individual nudge
  const renderNudge = (nudge: Nudge) => {
    const styles = getNudgeStyles(nudge.nudge_type);

    // Block nudge (full screen modal)
    if (nudge.nudge_type === "block") {
      return (
        <div
          key={nudge.nudge_id}
          className={`fixed inset-0 ${styles.bg} ${styles.text} ${styles.zIndex} flex items-center justify-center`}
        >
          <div className="max-w-2xl mx-auto p-8 text-center">
            <div className="text-6xl mb-6">{styles.icon}</div>
            <h1 className="text-4xl font-bold mb-4">Interview Terminated</h1>
            <p className="text-xl mb-8 leading-relaxed">{nudge.message}</p>
            <div className="bg-white/10 rounded-lg p-6 mb-6">
              <p className="text-sm">
                This incident has been logged and flagged for review by
                administrators. You will be redirected to the dashboard.
              </p>
            </div>
            <div className="text-sm opacity-80">
              If you believe this is an error, please contact your
              administrator.
            </div>
          </div>
        </div>
      );
    }

    // Info/Warning nudge (banner)
    return (
      <div
        key={nudge.nudge_id}
        className={`fixed left-1/2 transform -translate-x-1/2 ${styles.position} ${styles.zIndex}
                   max-w-3xl w-full mx-4 animate-slide-in-up`}
      >
        <div
          className={`${styles.bg} ${styles.text} rounded-lg shadow-2xl p-4 flex items-start gap-4`}
        >
          <div className="text-3xl flex-shrink-0">{styles.icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-medium leading-relaxed">
              {nudge.message}
            </p>
          </div>
          <button
            onClick={() => acknowledgeNudge(nudge.nudge_id)}
            className="flex-shrink-0 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-md
                     font-medium transition-colors duration-200"
          >
            {nudge.nudge_type === "warning" ? "Acknowledge" : "Dismiss"}
          </button>
        </div>
      </div>
    );
  };

  // Don't render anything if no nudges
  if (nudges.length === 0) {
    return null;
  }

  return (
    <>
      {nudges.map((nudge) => renderNudge(nudge))}

      {/* Connection status indicator (only show if disconnected) */}
      {!isConnected && (
        <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg text-sm z-30">
          ⚠️ Bias monitoring disconnected
        </div>
      )}

      {/* Animation styles */}
      <style jsx global>{`
        @keyframes slide-in-up {
          from {
            opacity: 0;
            transform: translate(-50%, 20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }

        .animate-slide-in-up {
          animation: slide-in-up 0.3s ease-out forwards;
        }
      `}</style>
    </>
  );
}
