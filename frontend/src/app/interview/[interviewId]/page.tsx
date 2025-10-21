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
import { SkeletonCard } from '@/components/Skeleton';
import {
  Video, VideoOff, Phone, PhoneOff, Mic, MicOff, Monitor,
  User, Shield, Activity, Clock, AlertCircle, CheckCircle2,
  Loader2, ArrowLeft, Radio, FileText, Eye, EyeOff,
  Maximize2, Minimize2, Volume2, VolumeX, Sparkles
} from 'lucide-react';

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

  // UI state
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  const localVideoRef = useRef<Webcam>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callStartTimeRef = useRef<number | null>(null);

  const audioStreaming = useInterviewAudio({
    interviewId: Number(interviewId),
    speaker,
    enabled: isCallStarted && !interviewBlocked && isAdmin,
  });

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isCallStarted && !interviewBlocked) {
      if (!callStartTimeRef.current) {
        callStartTimeRef.current = Date.now();
      }
      interval = setInterval(() => {
        if (callStartTimeRef.current) {
          setCallDuration(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
        }
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isCallStarted, interviewBlocked]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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
      setConnectionStatus('connected');
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected') {
        setConnectionStatus('connected');
      } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        setConnectionStatus('disconnected');
      } else if (pc.iceConnectionState === 'checking') {
        setConnectionStatus('connecting');
      }
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
        setConnectionStatus('connecting');
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

  const toggleMute = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const startCall = async () => {
    if (peerConnectionRef.current && localStream && !isCallStarted) {
      setIsCallStarted(true);
      setConnectionStatus('connecting');
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

  // Start audio capture only when the WebSocket is connected and the call has started
  useEffect(() => {
    if (audioStreaming.isConnected && localStream && isAdmin) {
      console.log("Audio WebSocket connected, starting audio capture.");
      audioStreaming.startCapture(localStream);
    }
  }, [audioStreaming.isConnected, localStream, isAdmin]);

  const endCall = () => {
    audioStreaming.stopCapture();

    if (peerConnectionRef.current) peerConnectionRef.current.close();
    if (socketRef.current) socketRef.current.close();
    if (localStream) localStream.getTracks().forEach(track => track.stop());

    setConnectionStatus('disconnected');
    callStartTimeRef.current = null;
    setCallDuration(0);

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
    } catch (error) {
      console.error("Failed to save score:", error);
    } finally {
      setIsSavingScore(false);
      handleCloseModal();
    }
  };

  const handleInterviewBlocked = useCallback(() => {
    setInterviewBlocked(true);
    setIsCallStarted(false);
    setConnectionStatus('disconnected');
    setTimeout(() => endCall(), 10000);
  }, []);

  if (isStudentLoading || isAdminLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 transition-all duration-200 font-medium text-sm hover:scale-105"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center">
                  <Video className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    Interview Room
                    <Sparkles className="h-5 w-5 text-yellow-300" />
                  </h1>
                  <p className="text-white/80 text-sm">Session ID: {interviewId}</p>
                </div>
              </div>
            </div>

            {/* Connection Status Badge */}
            <div className="flex items-center gap-3">
              {isCallStarted && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20">
                  <Clock className="h-4 w-4" />
                  <span className="font-mono font-semibold">{formatDuration(callDuration)}</span>
                </div>
              )}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg backdrop-blur-sm border ${
                connectionStatus === 'connected'
                  ? 'bg-green-500/20 border-green-300/30 text-white'
                  : connectionStatus === 'connecting'
                  ? 'bg-yellow-500/20 border-yellow-300/30 text-white'
                  : 'bg-white/10 border-white/20 text-white/80'
              }`}>
                <div className={`h-2 w-2 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-green-400 animate-pulse'
                    : connectionStatus === 'connecting'
                    ? 'bg-yellow-400 animate-pulse'
                    : 'bg-gray-400'
                }`} />
                <span className="text-sm font-medium capitalize">{connectionStatus}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Video Section - Takes 3 columns */}
          <div className="lg:col-span-3 space-y-6">
            {/* Remote Video (Large) */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <Monitor className="h-5 w-5" />
                  <h2 className="font-bold">Remote Participant</h2>
                </div>
                {remoteStream && (
                  <div className="flex items-center gap-2 text-white/90 text-sm">
                    <Radio className="h-4 w-4 animate-pulse text-green-300" />
                    Live
                  </div>
                )}
              </div>
              <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 aspect-video">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {!remoteStream && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center text-white/60">
                      <User className="h-20 w-20 mx-auto mb-4 opacity-40" />
                      <p className="text-lg font-medium">Waiting for remote participant...</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Local Video (Smaller) */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-primary-500 to-indigo-600 px-6 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-white">
                  <User className="h-5 w-5" />
                  <h2 className="font-bold">Your Camera ({speaker})</h2>
                </div>
                {localStream && (
                  <div className="flex items-center gap-3">
                    {isVideoOff ? (
                      <div className="flex items-center gap-1 text-red-300 text-sm">
                        <VideoOff className="h-4 w-4" />
                        Off
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-green-300 text-sm">
                        <Video className="h-4 w-4" />
                        On
                      </div>
                    )}
                    {isMuted ? (
                      <div className="flex items-center gap-1 text-red-300 text-sm">
                        <MicOff className="h-4 w-4" />
                        Muted
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-green-300 text-sm">
                        <Mic className="h-4 w-4" />
                        Active
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="relative bg-gradient-to-br from-gray-900 to-gray-800">
                <Webcam
                  audio={true}
                  onUserMedia={setLocalStream}
                  ref={localVideoRef}
                  mirrored={true}
                  className="w-full h-auto"
                  videoConstraints={{ aspectRatio: 16 / 9 }}
                />
                {isVideoOff && (
                  <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                    <div className="text-center text-white/60">
                      <VideoOff className="h-16 w-16 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">Camera Off</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Control Panel */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
              <div className="flex items-center justify-center gap-4">
                {!isCallStarted ? (
                  <button
                    onClick={startCall}
                    disabled={!localStream || interviewBlocked}
                    className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl hover:from-green-700 hover:to-emerald-700 transition-all font-bold shadow-lg hover:shadow-xl disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed text-lg"
                  >
                    <Phone className="h-6 w-6" />
                    {interviewBlocked ? 'Interview Blocked' : 'Start Interview'}
                  </button>
                ) : (
                  <>
                    {/* Mute Button */}
                    <button
                      onClick={toggleMute}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all shadow-md hover:shadow-lg ${
                        isMuted
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                      }`}
                    >
                      {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                      {isMuted ? 'Unmute' : 'Mute'}
                    </button>

                    {/* Video Toggle */}
                    <button
                      onClick={toggleVideo}
                      className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all shadow-md hover:shadow-lg ${
                        isVideoOff
                          ? 'bg-red-600 hover:bg-red-700 text-white'
                          : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                      }`}
                    >
                      {isVideoOff ? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />}
                      {isVideoOff ? 'Turn On' : 'Turn Off'}
                    </button>

                    {/* End Call */}
                    <button
                      onClick={endCall}
                      className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl hover:from-red-700 hover:to-rose-700 transition-all font-bold shadow-lg hover:shadow-xl"
                    >
                      <PhoneOff className="h-5 w-5" />
                      End Interview
                    </button>
                  </>
                )}
              </div>

              {interviewBlocked && (
                <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
                  <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-red-900 mb-1">Interview Blocked</h3>
                    <p className="text-sm text-red-700">
                      This interview has been blocked due to policy violations. The session will end automatically.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Status & Info */}
          <div className="space-y-6">
            {/* Session Info */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary-600" />
                  Session Info
                </h3>
                <div className="space-y-3">
                  <div className="p-3 bg-gradient-to-r from-primary-50 to-indigo-50 rounded-lg border border-primary-200">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Role</p>
                    <p className="font-semibold text-gray-900 flex items-center gap-2">
                      {isAdmin ? (
                        <>
                          <Shield className="h-4 w-4 text-primary-600" />
                          Administrator
                        </>
                      ) : (
                        <>
                          <User className="h-4 w-4 text-primary-600" />
                          Student
                        </>
                      )}
                    </p>
                  </div>

                  <div className="p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Status</p>
                    <p className="font-semibold text-gray-900 capitalize">{connectionStatus}</p>
                  </div>

                  {isCallStarted && (
                    <div className="p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">Duration</p>
                      <p className="font-mono font-bold text-2xl text-gray-900">{formatDuration(callDuration)}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Admin Controls */}
            {isAdmin && (
              <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Shield className="h-5 w-5 text-purple-600" />
                    Admin Controls
                  </h3>

                  {isCallStarted && (
                    <div className="space-y-3">
                      {/* Audio Monitoring Status */}
                      <div className={`p-3 rounded-lg border-2 ${
                        audioStreaming.isConnected
                          ? 'bg-green-50 border-green-200'
                          : 'bg-red-50 border-red-200'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          {audioStreaming.isConnected ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                          ) : (
                            <AlertCircle className="h-5 w-5 text-red-600" />
                          )}
                          <p className={`text-sm font-semibold ${
                            audioStreaming.isConnected ? 'text-green-900' : 'text-red-900'
                          }`}>
                            Audio Monitoring
                          </p>
                        </div>
                        <p className={`text-xs ${
                          audioStreaming.isConnected ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {audioStreaming.isConnected ? 'Active & Recording' : 'Disconnected'}
                        </p>
                      </div>

                      {/* Transcript Status */}
                      {audioStreaming.lastTranscriptId && (
                        <div className="p-3 bg-primary-50 border-2 border-primary-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="h-5 w-5 text-primary-600" />
                            <p className="text-sm font-semibold text-primary-900">
                              Last Transcript
                            </p>
                          </div>
                          <p className="text-xs text-primary-700 font-mono">
                            ID: #{audioStreaming.lastTranscriptId}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {!isCallStarted && (
                    <p className="text-sm text-gray-600 italic">
                      Start the call to access admin controls
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Guidelines */}
            <div className="bg-gradient-to-br from-primary-600 to-indigo-700 rounded-2xl shadow-lg p-6 text-white">
              <div className="flex items-center gap-2 mb-4">
                <FileText className="h-5 w-5" />
                <h3 className="font-bold text-lg">Interview Guidelines</h3>
              </div>
              <ul className="space-y-2 text-sm text-white/95">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">1</span>
                  <span>Ensure good lighting and minimal background noise</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">2</span>
                  <span>Test your camera and microphone before starting</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">3</span>
                  <span>Stay focused and maintain professional conduct</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">4</span>
                  <span>Keep your face visible throughout the session</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Nudge Overlay for Admin */}
      {isAdmin && admin && (
        <NudgeOverlay
          interviewId={Number(interviewId)}
          adminId={admin.admin_id}
          onBlock={handleInterviewBlocked}
        />
      )}

      {/* Score Modal */}
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
