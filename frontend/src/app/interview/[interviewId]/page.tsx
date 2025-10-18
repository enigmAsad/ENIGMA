'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Webcam from 'react-webcam';
import { useAuth as useStudentAuth } from '@/hooks/useStudentAuth';
import { useAdminAuth } from '@/hooks/useAdminAuth';

const InterviewRoomPage = () => {
  const { interviewId } = useParams();
  const router = useRouter();

  // Auth hooks to determine role for redirection
  const { student } = useStudentAuth();
  const { admin } = useAdminAuth();

  // Refs for mutable objects that don't trigger re-renders
  const socketRef = useRef<WebSocket | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);

  // State for UI and to trigger effects when streams are ready
  const [isCallStarted, setIsCallStarted] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<Webcam>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Setup Peer Connection
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

  // Setup WebSocket
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

  // Attach remote stream to video element when it arrives
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
    }
  };

  const endCall = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (socketRef.current) {
      socketRef.current.close();
    }
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }

    // Redirect to the correct dashboard based on user role
    if (admin) {
      router.push('/admin/interviews');
    } else if (student) {
      router.push('/student/dashboard');
    } else {
      router.push('/'); // Fallback to home page
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Interview Room: {interviewId}</h1>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h2 className="text-lg font-semibold">Your View</h2>
          <Webcam
            audio={true}
            onUserMedia={setLocalStream}
            ref={localVideoRef}
            mirrored={true}
            className="w-full h-auto bg-black"
          />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Remote View</h2>
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-auto bg-black" />
        </div>
      </div>
      <div className="mt-4 flex space-x-4">
        <button 
          onClick={startCall} 
          disabled={isCallStarted || !localStream}
          className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400"
        >
          {isCallStarted ? 'Call Active' : 'Start Call'}
        </button>
        {isCallStarted && (
          <button 
            onClick={endCall} 
            className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors"
          >
            End Call
          </button>
        )}
      </div>
    </div>
  );
};

export default InterviewRoomPage;
