import { useEffect, useRef, useState, useCallback } from "react";

interface UseInterviewAudioProps {
  interviewId: number;
  speaker: "admin" | "student";
  enabled: boolean; // Only stream when interview is active
}

interface TranscriptStatus {
  status: string;
  transcript_id?: number;
}

export function useInterviewAudio({
  interviewId,
  speaker,
  enabled,
}: UseInterviewAudioProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastTranscriptId, setLastTranscriptId] = useState<number | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);

  // Connect to audio WebSocket
  useEffect(() => {
    if (!enabled || !interviewId) {
      return;
    }

    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000"}/ws/interview/${interviewId}/audio?speaker=${speaker}`;

    console.log(`Connecting to audio stream: ${wsUrl}`);
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log("Audio WebSocket connected");
      setIsConnected(true);
    };

    websocket.onmessage = (event) => {
      try {
        const data: TranscriptStatus = JSON.parse(event.data);
        if (data.status === "transcribed" && data.transcript_id) {
          console.log(`Audio chunk transcribed: ${data.transcript_id}`);
          setLastTranscriptId(data.transcript_id);
        }

        if (data.error) {
          console.error("Audio stream error:", data.error);
        }
      } catch (error) {
        console.error("Error parsing audio status:", error);
      }
    };

    websocket.onerror = (error) => {
      console.error("Audio WebSocket error:", error);
      setIsConnected(false);
    };

    websocket.onclose = () => {
      console.log("Audio WebSocket disconnected");
      setIsConnected(false);
    };

    wsRef.current = websocket;

    // Cleanup
    return () => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
    };
  }, [interviewId, speaker, enabled]);

  // Start audio capture
  const startCapture = useCallback(async (stream: MediaStream) => {
    try {
      // Create audio-only stream from the media stream
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        console.error("No audio track found in stream");
        return;
      }

      const audioStream = new MediaStream([audioTrack]);
      audioStreamRef.current = audioStream;

      // Create MediaRecorder for audio
      const mediaRecorder = new MediaRecorder(audioStream, {
        mimeType: "audio/webm;codecs=opus",
        audioBitsPerSecond: 16000, // 16kbps for speech
      });

      mediaRecorderRef.current = mediaRecorder;

      // Handle audio data
      mediaRecorder.ondataavailable = (event) => {
        if (
          event.data.size > 0 &&
          wsRef.current &&
          wsRef.current.readyState === WebSocket.OPEN
        ) {
          // Convert Blob to ArrayBuffer and send
          event.data.arrayBuffer().then((buffer) => {
            console.log(`Sending ${speaker} audio stream chunk: ${buffer.byteLength} bytes`);
            wsRef.current?.send(buffer);
          });
        }
      };

      // Start recording in 1-second chunks
      mediaRecorder.start(1000);
      console.log("Audio capture started");
    } catch (error) {
      console.error("Failed to start audio capture:", error);
    }
  }, []);

  // Stop audio capture
  const stopCapture = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }

    console.log("Audio capture stopped");
  }, []);

  return {
    isConnected,
    lastTranscriptId,
    startCapture,
    stopCapture,
  };
}
