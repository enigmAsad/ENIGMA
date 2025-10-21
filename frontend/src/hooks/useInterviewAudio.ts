import { useEffect, useRef, useState, useCallback } from "react";

// ============================================================================
// Web Audio API based PCM audio capture
// ============================================================================

// --- Interfaces and Types ---
interface UseInterviewAudioProps {
  interviewId: number;
  speaker: "admin" | "student";
  enabled: boolean; // Only stream when interview is active
}

interface TranscriptStatus {
  status: string;
  transcript_id?: number;
  text?: string;
  error?: string;
}

// --- Audio Processing Configuration ---
const TARGET_SAMPLE_RATE = 16000; // 16kHz for speech recognition
const SCRIPT_PROCESSOR_BUFFER_SIZE = 4096; // Buffer size for audio processing

// --- Main Hook ---
export function useInterviewAudio({
  interviewId,
  speaker,
  enabled,
}: UseInterviewAudioProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastTranscriptId, setLastTranscriptId] = useState<number | null>(null);
  const [transcribedText, setTranscribedText] = useState<string[]>([]); // NEW: State to store transcribed text

  // Refs for Web Audio API objects and WebSocket
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Connect to audio WebSocket
  useEffect(() => {
    if (!enabled || !interviewId) {
      return;
    }

    const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000"}/ws/interview/${interviewId}/audio?speaker=${speaker}`;
    console.log(`[useInterviewAudio] Connecting to audio stream: ${wsUrl}`);
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log("[useInterviewAudio] Audio WebSocket connected");
      setIsConnected(true);
    };

    websocket.onmessage = (event) => {
      try {
        const data: TranscriptStatus = JSON.parse(event.data);
        if (data.status === "transcribed" && data.transcript_id) {
          console.log(`[useInterviewAudio] Audio chunk transcribed with ID: ${data.transcript_id}`);
          if (data.text) {
            console.log(`[useInterviewAudio] --> Transcribed Text: "${data.text}"`);
            setTranscribedText((prev) => [...prev, data.text!]); // NEW: Add new text to state, using non-null assertion
          }
          setLastTranscriptId(data.transcript_id);
        }
        if (data.error) {
          console.error("[useInterviewAudio] Audio stream error from server:", data.error);
        }
      } catch (error) {
        console.error("[useInterviewAudio] Error parsing audio status message:", error);
      }
    };

    websocket.onerror = (error) => {
      console.error("[useInterviewAudio] Audio WebSocket error:", error);
      setIsConnected(false);
    };

    websocket.onclose = () => {
      console.log("[useInterviewAudio] Audio WebSocket disconnected");
      setIsConnected(false);
    };

    wsRef.current = websocket;

    return () => {
      if (websocket.readyState === WebSocket.OPEN) {
        websocket.close();
      }
    };
  }, [interviewId, speaker, enabled]);

  /**
   * Downsamples and converts float32 audio data to 16-bit PCM.
   */
  const processAudio = (event: AudioProcessingEvent) => {
    const inputData = event.inputBuffer.getChannelData(0);
    const inputSampleRate = event.inputBuffer.sampleRate;

    // Simple downsampling (taking every Nth sample)
    const sampleRateRatio = inputSampleRate / TARGET_SAMPLE_RATE;
    const newLength = Math.round(inputData.length / sampleRateRatio);
    const downsampledData = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      downsampledData[i] = inputData[Math.round(i * sampleRateRatio)];
    }

    // Convert to 16-bit PCM
    const pcmData = new Int16Array(newLength);
    for (let i = 0; i < newLength; i++) {
      let s = Math.max(-1, Math.min(1, downsampledData[i]));
      pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Send data over WebSocket if connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(pcmData.buffer);
    }
  };

  // Start capturing raw audio
  const startCapture = useCallback(async (stream: MediaStream) => {
    if (!stream || audioContextRef.current) {
      return;
    }

    console.log("[useInterviewAudio] Starting raw audio capture...");
    try {
      const context = new window.AudioContext();
      audioContextRef.current = context;

      // On some browsers, the AudioContext starts in a "suspended" state
      // and needs to be resumed by a user gesture.
      if (context.state === 'suspended') {
        await context.resume();
      }

      // Create a script processor node for direct audio processing
      const scriptNode = context.createScriptProcessor(SCRIPT_PROCESSOR_BUFFER_SIZE, 1, 1);
      scriptNode.onaudioprocess = processAudio;
      scriptProcessorNodeRef.current = scriptNode;

      // Create a media stream source from the user's microphone stream
      const sourceNode = context.createMediaStreamSource(stream);
      mediaStreamSourceRef.current = sourceNode;

      // Connect the nodes: Source -> Processor -> Destination (to keep it alive)
      sourceNode.connect(scriptNode);
      scriptNode.connect(context.destination);

      console.log("[useInterviewAudio] Raw audio capture started successfully.");

    } catch (error) {
      console.error("[useInterviewAudio] Failed to start raw audio capture:", error);
    }
  }, []);

  // Stop audio capture
  const stopCapture = useCallback(() => {
    console.log("[useInterviewAudio] Stopping raw audio capture...");
    if (audioContextRef.current) {
      // Disconnect nodes
      if (mediaStreamSourceRef.current) {
        mediaStreamSourceRef.current.disconnect();
        mediaStreamSourceRef.current = null;
      }
      if (scriptProcessorNodeRef.current) {
        scriptProcessorNodeRef.current.disconnect();
        scriptProcessorNodeRef.current.onaudioprocess = null;
        scriptProcessorNodeRef.current = null;
      }
      // Close the audio context
      if (audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
    }
    console.log("[useInterviewAudio] Raw audio capture stopped.");
  }, []);

  return {
    isConnected,
    lastTranscriptId,
    transcribedText, // NEW: Return transcribed text
    startCapture,
    stopCapture,
  };
}
