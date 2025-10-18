'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import Webcam from 'react-webcam';

const InterviewRoomPage = () => {
  const { interviewId } = useParams();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<Webcam>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const ws = new WebSocket(`ws://localhost:8000/ws/interview/${interviewId}`);
    setSocket(ws);

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.offer) {
        handleOffer(message.offer);
      } else if (message.answer) {
        handleAnswer(message.answer);
      } else if (message.candidate) {
        handleCandidate(message.candidate);
      }
    };

    return () => {
      ws.close();
    };
  }, [interviewId]);

  useEffect(() => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    setPeerConnection(pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage({ candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    return () => {
      pc.close();
    };
  }, []);

  const sendMessage = (message: any) => {
    if (socket) {
      socket.send(JSON.stringify(message));
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit) => {
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      sendMessage({ answer });
    }
  };

  const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
    if (peerConnection) {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  const handleCandidate = async (candidate: RTCIceCandidateInit) => {
    if (peerConnection) {
      await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  const startCall = async () => {
    if (peerConnection && localVideoRef.current && localVideoRef.current.stream) {
      localVideoRef.current.stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localVideoRef.current.stream as MediaStream);
      });

      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      sendMessage({ offer });
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
      <div className="mt-4">
        <button onClick={startCall} className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors">
          Start Call
        </button>
      </div>
    </div>
  );
};

export default InterviewRoomPage;
