'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useStudentAuth';
import { studentApiClient } from '@/lib/studentApi';
import type { InterviewDetails } from '@/lib/adminApi';
import {
  Video, Calendar, Clock, CheckCircle2, XCircle,
  AlertCircle, Loader2, ArrowRight, Info, ChevronRight, MapPin
} from 'lucide-react';

const StudentInterviewsPage = () => {
  const router = useRouter();
  const { student, loading } = useAuth();
  const [interviews, setInterviews] = useState<InterviewDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!loading && !student) {
      router.push('/student/login');
    }
  }, [loading, student, router]);

  // Fetch interviews only when authenticated
  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const data = await studentApiClient.getInterviews();
        setInterviews(data);
        setError(null);
      } catch (e: any) {
        setError(e?.message || 'Failed to load interviews');
        setInterviews([]);
      } finally {
        setIsLoading(false);
      }
    };
    if (student) {
      load();
    } else {
      setInterviews([]);
      setIsLoading(false);
    }
  }, [student]);

  // Get status badge style
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; icon: any; bg: string }> = {
      scheduled: { label: 'Scheduled', color: 'text-blue-700', icon: Calendar, bg: 'bg-blue-100' },
      completed: { label: 'Completed', color: 'text-green-700', icon: CheckCircle2, bg: 'bg-green-100' },
      cancelled: { label: 'Cancelled', color: 'text-red-700', icon: XCircle, bg: 'bg-red-100' },
      in_progress: { label: 'In Progress', color: 'text-purple-700', icon: Video, bg: 'bg-purple-100' },
    };
    return statusMap[status] || { label: status, color: 'text-gray-700', icon: Info, bg: 'bg-gray-100' };
  };

  // Calculate if interview is joinable
  const getInterviewAvailability = (interview: InterviewDetails) => {
    const now = new Date();
    const interviewTime = new Date(interview.interview_time);
    const oneDay = 24 * 60 * 60 * 1000;
    const isScheduled = interview.status === 'scheduled';
    const isWithinWindow =
      now.getTime() >= interviewTime.getTime() - oneDay &&
      now.getTime() <= interviewTime.getTime() + oneDay;

    return {
      canJoin: isScheduled && isWithinWindow,
      isPast: now.getTime() > interviewTime.getTime() + oneDay,
      isFuture: now.getTime() < interviewTime.getTime() - oneDay,
      timeUntil: interviewTime.getTime() - now.getTime(),
    };
  };

  // Format time remaining
  const formatTimeRemaining = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `in ${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `in ${hours} hour${hours > 1 ? 's' : ''}`;
    return 'soon';
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-primary-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading your interviews...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-primary-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-8 max-w-md">
          <div className="flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Error Loading Interviews</h3>
          <p className="text-gray-600 text-center mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Separate interviews by status
  const upcomingInterviews = interviews.filter(i => {
    const availability = getInterviewAvailability(i);
    return i.status === 'scheduled' && !availability.isPast;
  });

  const pastInterviews = interviews.filter(i => {
    const availability = getInterviewAvailability(i);
    return i.status === 'completed' || availability.isPast;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-primary-50 to-indigo-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center">
              <Video className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold">My Interviews</h1>
              <p className="text-primary-100 mt-1">Manage your scheduled interview sessions</p>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-white/80 text-sm">Total Interviews</p>
                  <p className="text-2xl font-bold text-white">{interviews.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-white/80 text-sm">Upcoming</p>
                  <p className="text-2xl font-bold text-white">{upcomingInterviews.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-white/80 text-sm">Completed</p>
                  <p className="text-2xl font-bold text-white">{pastInterviews.length}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {interviews.length === 0 ? (
          // Empty State
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-primary-100 mb-6">
                <Video className="h-10 w-10 text-primary-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">No Interviews Scheduled</h2>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                You don't have any interviews scheduled at the moment. Interviews are typically scheduled after
                your application passes the initial evaluation phase.
              </p>
              <button
                onClick={() => router.push('/student/dashboard')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all font-medium shadow-md hover:shadow-lg"
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Upcoming Interviews */}
            {upcomingInterviews.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Clock className="h-6 w-6 text-primary-600" />
                  Upcoming Interviews
                </h2>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {upcomingInterviews.map((interview) => {
                    const interviewTime = new Date(interview.interview_time);
                    const availability = getInterviewAvailability(interview);
                    const statusBadge = getStatusBadge(interview.status);

                    return (
                      <div
                        key={interview.id}
                        className="bg-white rounded-2xl shadow-lg border-2 border-primary-200 overflow-hidden hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
                      >
                        {/* Card Header */}
                        <div className="bg-gradient-to-r from-primary-500 to-indigo-600 px-6 py-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-white">Phase 2 Interview</h3>
                            <div className={`px-3 py-1 rounded-full text-xs font-semibold ${statusBadge.bg} ${statusBadge.color} flex items-center gap-1`}>
                              <statusBadge.icon className="h-3 w-3" />
                              {statusBadge.label}
                            </div>
                          </div>
                        </div>

                        {/* Card Body */}
                        <div className="p-6 space-y-4">
                          {/* Date & Time */}
                          <div className="flex items-start gap-3 p-4 bg-primary-50 rounded-lg">
                            <Calendar className="h-5 w-5 text-primary-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-700 mb-1">Scheduled Time</p>
                              <p className="text-lg font-bold text-gray-900">
                                {interviewTime.toLocaleString('en-US', {
                                  weekday: 'long',
                                  year: 'numeric',
                                  month: 'long',
                                  day: 'numeric',
                                })}
                              </p>
                              <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                {interviewTime.toLocaleString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true,
                                })}
                              </p>
                            </div>
                          </div>

                          {/* Application ID */}
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Application ID:</span>
                            <span className="font-mono font-bold text-gray-900">{interview.application_id}</span>
                          </div>

                          {/* Time Until */}
                          {availability.isFuture && (
                            <div className="flex items-center gap-2 text-sm text-gray-600 bg-blue-50 p-3 rounded-lg">
                              <Info className="h-4 w-4 text-blue-600 flex-shrink-0" />
                              <span>Interview starts {formatTimeRemaining(availability.timeUntil)}</span>
                            </div>
                          )}

                          {/* Join Button */}
                          <div className="pt-2">
                            <button
                              onClick={() => router.push(`/interview/${interview.id}`)}
                              disabled={!availability.canJoin}
                              className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                                availability.canJoin
                                  ? 'bg-gradient-to-r from-primary-600 to-indigo-600 text-white hover:from-primary-700 hover:to-indigo-700 shadow-md hover:shadow-lg'
                                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              }`}
                            >
                              <Video className="h-5 w-5" />
                              {availability.canJoin ? 'Join Interview Now' : 'Not Available Yet'}
                              {availability.canJoin && <ChevronRight className="h-4 w-4" />}
                            </button>
                            {!availability.canJoin && (
                              <p className="text-xs text-center text-yellow-600 mt-2">
                                ⏰ Available 24 hours before and after the scheduled time
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Past/Completed Interviews */}
            {pastInterviews.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                  Past Interviews
                </h2>
                <div className="space-y-4">
                  {pastInterviews.map((interview) => {
                    const interviewTime = new Date(interview.interview_time);
                    const statusBadge = getStatusBadge(interview.status);

                    return (
                      <div
                        key={interview.id}
                        className="bg-white rounded-xl shadow border border-gray-200 p-6 hover:shadow-md transition-shadow"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center">
                              <Calendar className="h-6 w-6 text-gray-600" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 mb-1">Phase 2 Interview</h3>
                              <p className="text-sm text-gray-600">
                                {interviewTime.toLocaleString('en-US', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short',
                                })}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Application ID: <span className="font-mono">{interview.application_id}</span>
                              </p>
                            </div>
                          </div>
                          <div className={`px-4 py-2 rounded-lg text-sm font-semibold ${statusBadge.bg} ${statusBadge.color} flex items-center gap-2`}>
                            <statusBadge.icon className="h-4 w-4" />
                            {statusBadge.label}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info Card */}
        <div className="mt-8 bg-gradient-to-r from-primary-600 to-indigo-700 rounded-2xl shadow-lg p-6 text-white">
          <h3 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Info className="h-5 w-5" />
            Interview Guidelines
          </h3>
          <ul className="space-y-2 text-sm text-white/90">
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 mt-1">•</span>
              <span>Join your interview within the 24-hour window before or after the scheduled time</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 mt-1">•</span>
              <span>Ensure you have a stable internet connection and a working camera/microphone</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 mt-1">•</span>
              <span>Be professional and answer questions honestly during the interview</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 mt-1">•</span>
              <span>The interview is part of the bias-monitored Phase 2 evaluation process</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default StudentInterviewsPage;
