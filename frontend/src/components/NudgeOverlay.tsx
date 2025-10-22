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
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [hasAttemptedConnection, setHasAttemptedConnection] = useState(false);

  // Connect to nudge WebSocket
  useEffect(() => {
    // Derive WebSocket URL from API URL
    const getWebSocketUrl = () => {
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace(/\/$/, "");

      // Convert HTTP(S) to WS(S)
      let wsUrl = apiUrl.replace(/^http/, "ws");

      // Remove trailing slash if present
      wsUrl = wsUrl.replace(/\/$/, "");

      return wsUrl;
    };

    const wsBaseUrl = getWebSocketUrl();
    const wsUrl = `${wsBaseUrl}/ws/interview/${interviewId}/nudges?admin_id=${adminId}`;

    console.log(`Connecting to nudge stream: ${wsUrl}`);

    let websocket: WebSocket;

    try {
      websocket = new WebSocket(wsUrl);
      setHasAttemptedConnection(true);
      setConnectionError(null);
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      setIsConnected(false);
      setConnectionError("Failed to initialize bias monitoring connection");
      setHasAttemptedConnection(true);
      return;
    }

    websocket.onopen = () => {
      console.log("✅ Nudge WebSocket connected");
      setIsConnected(true);
      setConnectionError(null);
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

          console.log("📨 Received nudge:", newNudge);
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
          console.log(`✓ Nudge ${data.nudge_id} acknowledged by server`);
        }
      } catch (error) {
        console.error("Error parsing nudge message:", error);
      }
    };

    websocket.onerror = (error) => {
      console.error("❌ Nudge WebSocket error:", {
        error,
        readyState: websocket?.readyState,
        url: wsUrl,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      setIsConnected(false);
      setConnectionError("Bias monitoring connection failed - interviews will continue without real-time monitoring");
    };

    websocket.onclose = (event) => {
      console.log("🔌 Nudge WebSocket disconnected", {
        code: event.code,
        reason: event.reason || 'No reason provided',
        wasClean: event.wasClean
      });
      setIsConnected(false);

      // Only set error if it wasn't a clean close
      if (!event.wasClean && !connectionError) {
        setConnectionError("Bias monitoring disconnected - check your network connection");
      }
    };

    setWs(websocket);

    // Cleanup
    return () => {
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        console.log("🧹 Closing nudge WebSocket");
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
          className={`fixed inset-0 ${styles.bg} ${styles.text} ${styles.zIndex} flex items-center justify-center p-4 sm:p-8 overflow-y-auto`}
        >
          <div className="max-w-2xl w-full mx-auto p-6 sm:p-8 text-center space-y-4 sm:space-y-6">
            <div className="text-4xl sm:text-5xl md:text-6xl mb-4 sm:mb-6">{styles.icon}</div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">Interview Terminated</h1>
            <p className="text-base sm:text-lg md:text-xl leading-relaxed break-words">{nudge.message}</p>
            <div className="bg-white/10 rounded-lg p-4 sm:p-6">
              <p className="text-xs sm:text-sm">
                This incident has been logged and flagged for review by
                administrators. You will be redirected to the dashboard.
              </p>
            </div>
            <div className="text-xs sm:text-sm opacity-80">
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
        className={`fixed left-4 right-4 sm:left-1/2 sm:transform sm:-translate-x-1/2 ${styles.position} ${styles.zIndex}
                   sm:max-w-3xl sm:w-full`}
      >
        <div
          className={`animate-slide-in-up ${styles.bg} ${styles.text} rounded-lg shadow-2xl p-3 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 w-full max-h-[calc(100vh-4rem)] sm:max-h-[calc(100vh-5rem)] overflow-y-auto`}
        >
          <div className="text-2xl sm:text-3xl flex-shrink-0">{styles.icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm sm:text-base font-medium leading-relaxed break-words">
              {nudge.message}
            </p>
          </div>
          <button
            onClick={() => acknowledgeNudge(nudge.nudge_id)}
            className="w-full sm:w-auto flex-shrink-0 px-4 py-2.5 sm:py-2 bg-white/20 hover:bg-white/30 rounded-md
                     font-medium transition-colors duration-200 text-sm sm:text-base min-h-[44px] sm:min-h-[36px] touch-manipulation"
          >
            {nudge.nudge_type === "warning" ? "Acknowledge" : "Dismiss"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Render active nudges */}
      {nudges.map((nudge) => renderNudge(nudge))}

      {/* Connection warning - show if attempted but failed/disconnected */}
      {hasAttemptedConnection && !isConnected && connectionError && (
        <div className="fixed top-20 left-4 right-4 sm:left-1/2 sm:transform sm:-translate-x-1/2 sm:max-w-2xl bg-yellow-500 text-gray-900 px-4 py-3 rounded-lg shadow-xl text-sm z-40 flex items-start gap-3">
          <span className="text-xl flex-shrink-0 mt-0.5">⚠️</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold mb-1">Bias Monitoring Unavailable</p>
            <p className="text-xs opacity-90">{connectionError}</p>
            <p className="text-xs opacity-75 mt-1">
              The interview can proceed, but automated fairness checks are temporarily offline.
            </p>
          </div>
          <button
            onClick={() => setConnectionError(null)}
            className="text-gray-900 hover:text-gray-700 flex-shrink-0 text-lg font-bold"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Success indicator when connected */}
      {isConnected && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-3 py-2 rounded-lg shadow-lg text-xs flex items-center gap-2 z-30">
          <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
          <span>Bias monitoring active</span>
        </div>
      )}

      {/* Animation styles */}
      <style jsx global>{`
        @keyframes slide-in-up {
          from {
            opacity: 0;
            transform: translate3d(0, 12px, 0);
          }
          to {
            opacity: 1;
            transform: translate3d(0, 0, 0);
          }
        }

        .animate-slide-in-up {
          animation: slide-in-up 0.3s ease-out forwards;
        }
      `}</style>
    </>
  );
}
