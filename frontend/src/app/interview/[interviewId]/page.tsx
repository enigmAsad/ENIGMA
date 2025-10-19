'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Webcam from 'react-webcam';
import { useAuth as useStudentAuth } from '@/hooks/useStudentAuth';
import { useOptionalAdminAuth as useAdminAuth } from '@/hooks/useOptionalAdminAuth';
import { useInterviewAudio } from '@/hooks/useInterviewAudio';
import NudgeOverlay from '@/components/NudgeOverlay';
import InterviewScoreModal from '@/components/InterviewScoreModal';
import { adminApiClient } from '@/lib/adminApi';

const InterviewRoomPage = () => {
  const { interviewId } = useParams();
  const router = useRouter();

  const { student, isLoading: isStudentLoading } = useStudentAuth();
  const { admin, isLoading: isAdminLoading } = useAdminAuth();

  const [isScoreModalOpen, setScoreModalOpen] = useState(false);
  const [isSavingScore, setIsSavingScore] = useState(false);

  const isAdmin = !!admin;
  const speaker = isAdmin ? 'admin' : 'student';

  const socketRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  const [isCallStarted, setIsCallStarted] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [interviewBlocked, setInterviewBlocked] = useState(false);

  const localVideoRef = useRef<Webcam>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const audioStreaming = useInterviewAudio({
    interviewId: Number(interviewId),
    speaker,
    enabled: isCallStarted && !interviewBlocked && isAdmin,
  });

  useEffect(() => {
    if (!isStudentLoading && !isAdminLoading && !student && !admin) {
      router.push('/student/login');
    }
  }, [isStudentLoading, isAdminLoading, student, admin, router]);

  useEffect(() => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    peerConnectionRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ candidate: event.candidate }));
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
    };

    return () => {
      pc.close();
    };
  }, []);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/interview/${interviewId}`);
    socketRef.current = ws;

    const handleOffer = async (offer: RTCSessionDescriptionInit) => {
      if (peerConnectionRef.current && localVideoRef.current?.stream) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
        
        localVideoRef.current.stream.getTracks().forEach(track => {
          if (!peerConnectionRef.current?.getSenders().find(s => s.track === track)) {
            peerConnectionRef.current?.addTrack(track, localVideoRef.current?.stream as MediaStream);
          }
        });

        const answer = await peerConnectionRef.current.createAnswer();
        await peerConnectionRef.current.setLocalDescription(answer);
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(JSON.stringify({ answer }));
        }
        setIsCallStarted(true);
      }
    };

    const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
      if (peerConnectionRef.current?.signalingState === 'have-local-offer') {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      }
    };

    const handleCandidate = async (candidate: RTCIceCandidateInit) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
      }
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.offer) handleOffer(message.offer);
      else if (message.answer) handleAnswer(message.answer);
      else if (message.candidate) handleCandidate(message.candidate);
    };

    return () => {
      ws.close();
    };
  }, [interviewId]);

  useEffect(() => {
    if (remoteStream && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const startCall = async () => {
    if (peerConnectionRef.current && localStream && !isCallStarted) {
      setIsCallStarted(true);
      localStream.getTracks().forEach(track => {
        if (!peerConnectionRef.current?.getSenders().find(s => s.track === track)) {
          peerConnectionRef.current?.addTrack(track, localStream);
        }
      });

      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ offer }));
      }

      if (localStream) {
        audioStreaming.startCapture(localStream);
      }
    }
  };

  const endCall = () => {
    audioStreaming.stopCapture();

    if (peerConnectionRef.current) peerConnectionRef.current.close();
    if (socketRef.current) socketRef.current.close();
    if (localStream) localStream.getTracks().forEach(track => track.stop());

    if (isAdmin) {
      setScoreModalOpen(true);
    } else {
      router.push('/student/dashboard');
    }
  };

  const handleCloseModal = () => {
    setScoreModalOpen(false);
    router.push('/admin/interviews');
  };

  const handleSaveScore = async (scoreData: any) => {
    setIsSavingScore(true);
    try {
      await adminApiClient.addInterviewScore(Number(interviewId), scoreData);
      // Optionally show a success toast/message here
    } catch (error) {
      console.error("Failed to save score:", error);
      // Optionally show an error toast/message here
    } finally {
      setIsSavingScore(false);
      handleCloseModal();
    }
  };

  const handleInterviewBlocked = useCallback(() => {
    setInterviewBlocked(true);
    setIsCallStarted(false);
    setTimeout(() => endCall(), 10000);
  }, [endCall]);

  if (isStudentLoading || isAdminLoading) {
    return <div className="container mx-auto p-4">Loading session...</div>;
  }

  return (
    <div className="container mx-auto p-4 relative">
      <h1 className="text-2xl font-bold mb-4">Interview Room: {interviewId}</h1>

      {isCallStarted && isAdmin && (
        <div className="mb-4 flex gap-3 text-sm">
          <div
            className={`px-3 py-1 rounded-full ${
              audioStreaming.isConnected
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {audioStreaming.isConnected ? '✓' : '✗'} Audio Monitoring
          </div>
          {audioStreaming.lastTranscriptId && (
            <div className="px-3 py-1 rounded-full bg-blue-100 text-blue-800">
              📝 Transcribed: #{audioStreaming.lastTranscriptId}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <h2 className="text-lg font-semibold">Your View ({speaker})</h2>
          <Webcam
            audio={true}
            onUserMedia={setLocalStream}
            ref={localVideoRef}
            mirrored={true}
            className="w-full h-auto bg-black rounded-lg"
          />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Remote View</h2>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-auto bg-black rounded-lg"
          />
        </div>
      </div>

      <div className="mt-4 flex space-x-4">
        <button
          onClick={startCall}
          disabled={isCallStarted || !localStream || interviewBlocked}
          className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
        >
          {interviewBlocked ? 'Interview Blocked' : isCallStarted ? 'Call Active' : 'Start Call'}
        </button>
        {isCallStarted && !interviewBlocked && (
          <button
            onClick={endCall}
            className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors"
          >
            End Call
          </button>
        )}
      </div>

      {isAdmin && admin && (
        <NudgeOverlay
          interviewId={Number(interviewId)}
          adminId={admin.admin_id}
          onBlock={handleInterviewBlocked}
        />
      )}

      <InterviewScoreModal
        isOpen={isScoreModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveScore}
        isSaving={isSavingScore}
      />
    </div>
  );
};

export default InterviewRoomPage;
