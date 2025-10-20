'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useStudentAuth';
import { adminApiClient, InterviewDetails } from '@/lib/adminApi';
import { studentApiClient } from '@/lib/studentApi';
import { type AdmissionInfo } from '@/lib/adminApi';
import { SkeletonDashboard } from '@/components/Skeleton';
import {
  User, Mail, IdCard, FileText, CheckCircle2,
  Clock, AlertCircle, TrendingUp, Calendar, Shield,
  ChevronRight, Sparkles, Award, Target, Loader2,
  Video, BookOpen, BarChart3, Lock, Unlock
} from 'lucide-react';

export default function StudentDashboardPage() {
  const { student, loading, error } = useAuth();
  const router = useRouter();
  const [admissionInfo, setAdmissionInfo] = useState<AdmissionInfo | null>(null);
  const [interviews, setInterviews] = useState<InterviewDetails[]>([]);
  const [admissionLoading, setAdmissionLoading] = useState(true);

  useEffect(() => {
    if (!loading && !student) {
      router.push('/student/login');
    }
  }, [student, loading, router]);

  useEffect(() => {
    const fetchAdmissionInfo = async () => {
      try {
        const info = await adminApiClient.getAdmissionInfo();
        setAdmissionInfo(info);
      } catch (error) {
        console.error('Failed to fetch admission info:', error);
      } finally {
        setAdmissionLoading(false);
      }
    };

    const fetchInterviews = async () => {
      try {
        const interviewData = await studentApiClient.getInterviews();
        setInterviews(interviewData);
      } catch (error) {
        console.error('Failed to fetch interviews:', error);
      }
    };

    fetchAdmissionInfo();
    if (student) {
      fetchInterviews();
    }
  }, [student]);

  if (loading || admissionLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <SkeletonDashboard />
        </div>
      </div>
    );
  }

  const hasResults = student?.application?.results !== null && student?.application?.results !== undefined;
  const applicationStatus = student?.application?.status?.status;
  const isResultPublished = hasResults && ['selected', 'not_selected', 'published'].includes(applicationStatus || '');

  // Status helpers
  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; icon: any; bgColor: string }> = {
      submitted: { label: 'Submitted', color: 'text-blue-600', icon: CheckCircle2, bgColor: 'bg-blue-50' },
      preprocessing: { label: 'Pre-processing', color: 'text-yellow-600', icon: Clock, bgColor: 'bg-yellow-50' },
      scored: { label: 'Evaluated', color: 'text-indigo-600', icon: Award, bgColor: 'bg-indigo-50' },
      selection: { label: 'Under Review', color: 'text-purple-600', icon: Target, bgColor: 'bg-purple-50' },
      selected: { label: 'Selected', color: 'text-green-600', icon: CheckCircle2, bgColor: 'bg-green-50' },
      not_selected: { label: 'Not Selected', color: 'text-gray-600', icon: FileText, bgColor: 'bg-gray-50' },
    };
    return statusMap[status?.toLowerCase()] || { label: status, color: 'text-gray-600', icon: Clock, bgColor: 'bg-gray-50' };
  };

  const statusInfo = getStatusInfo(applicationStatus || '');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Hero Section with Profile */}
      <div className="bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6">
            <div className="flex items-start gap-3 sm:gap-4">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className="h-16 w-16 sm:h-18 sm:w-18 md:h-20 md:w-20 rounded-xl sm:rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center ring-4 ring-white/10">
                  <User className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 text-white" />
                </div>
              </div>

              {/* Profile Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 sm:mb-2">
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">
                    Welcome back, {student?.display_name?.split(' ')[0] || 'Student'}!
                  </h1>
                  <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-300 flex-shrink-0" />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-white/90 text-xs sm:text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="truncate">{student?.primary_email}</span>
                  </div>
                  <span className="hidden sm:inline">•</span>
                  <div className="flex items-center gap-2">
                    <IdCard className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    <span className="font-mono text-xs sm:text-sm">{student?.student_id}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Logout Button removed (already available in navbar) */}
          </div>

          {error && (
            <div className="mt-4 sm:mt-6 bg-red-500/20 backdrop-blur-sm border border-red-300/30 rounded-lg p-3 sm:p-4">
              <p className="text-white/95 text-xs sm:text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                {error}
              </p>
            </div>
          )}
        </div>
      </div>

      {student && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Left Column - Main Content */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-6">
              {/* Application Status Card */}
              {student.application ? (
                <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-300">
                  <div className="bg-gradient-to-r from-primary-500 to-indigo-600 px-4 sm:px-6 py-3 sm:py-4">
                    <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                      <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                      Application Status
                    </h2>
                  </div>
                  <div className="p-4 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6 mb-4 sm:mb-6">
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600 mb-1 sm:mb-1">Current Status</p>
                        <div className={`inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-semibold text-sm sm:text-base ${statusInfo.bgColor} ${statusInfo.color}`}>
                          <statusInfo.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                          {statusInfo.label}
                        </div>
                      </div>
                      {student.application.status?.application_id && (
                        <div className="text-left sm:text-right">
                          <p className="text-xs sm:text-sm text-gray-600 mb-1">Application ID</p>
                          <p className="font-mono font-bold text-sm sm:text-base text-gray-900">{student.application.status.application_id}</p>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                      <button
                        onClick={() => router.push('/student/applications')}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 min-h-[44px] px-4 sm:px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all font-medium shadow-md hover:shadow-lg text-sm sm:text-base touch-manipulation"
                      >
                        <FileText className="h-4 w-4" />
                        View Full Details
                        <ChevronRight className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => router.push('/verify')}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 min-h-[44px] px-4 sm:px-5 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium text-sm sm:text-base touch-manipulation"
                      >
                        <Shield className="h-4 w-4" />
                        Verify Results
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                // No Application Yet
                <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                  <div className="p-6 sm:p-8 text-center">
                    <div className="inline-flex items-center justify-center h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-primary-100 mb-3 sm:mb-4">
                      <FileText className="h-7 w-7 sm:h-8 sm:w-8 text-primary-600" />
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">No Application Yet</h3>
                    <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 px-4">You haven't submitted an application for the current cycle.</p>
                    {admissionInfo?.is_open ? (
                      <button
                        onClick={() => router.push('/student/apply')}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[48px] px-5 sm:px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all font-medium shadow-md hover:shadow-lg text-sm sm:text-base touch-manipulation"
                      >
                        <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
                        Start Application Now
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    ) : (
                      <p className="text-xs sm:text-sm text-gray-500">Admissions are currently closed. Check back later!</p>
                    )}
                  </div>
                </div>
              )}

              {/* Interviews Card */}
              {interviews.length > 0 && (
                <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-300">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-600 px-4 sm:px-6 py-3 sm:py-4">
                    <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                      <Video className="h-4 w-4 sm:h-5 sm:w-5" />
                      Upcoming Interviews
                    </h2>
                  </div>
                  <div className="p-4 sm:p-6 space-y-4">
                    {interviews.map(interview => {
                      const now = new Date();
                      const interviewTime = new Date(interview.interview_time);
                      const oneDay = 24 * 60 * 60 * 1000;
                      const isScheduled = interview.status === 'scheduled';
                      const isWithinWindow =
                        now.getTime() >= (interviewTime.getTime() - oneDay) &&
                        now.getTime() <= (interviewTime.getTime() + oneDay);
                      const isJoinable = isScheduled && isWithinWindow;

                      return (
                        <div key={interview.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 sm:p-4 bg-purple-50 rounded-lg">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                              <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1">
                                Phase 2 Interview
                              </h3>
                              <p className="text-xs sm:text-sm text-gray-600 flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                <span className="break-words">{interviewTime.toLocaleString('en-US', {
                                  dateStyle: 'medium',
                                  timeStyle: 'short'
                                })}</span>
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Status: <span className="font-medium">{interview.status}</span>
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 w-full sm:w-auto">
                            <button
                              onClick={() => router.push(`/interview/${interview.id}`)}
                              disabled={!isJoinable}
                              className={`w-full min-h-[44px] px-5 sm:px-6 py-2.5 rounded-lg font-medium transition-all text-sm sm:text-base touch-manipulation ${
                                isJoinable
                                  ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-md hover:shadow-lg'
                                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              }`}
                            >
                              {isJoinable ? 'Join Now' : 'Not Available Yet'}
                            </button>
                            {!isJoinable && (
                              <p className="text-xs text-yellow-600 text-center">
                                Available 24h before/after
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Results Card */}
              {isResultPublished && (
                <div className={`rounded-xl sm:rounded-2xl shadow-lg border-2 overflow-hidden ${
                  student.application?.results?.status === 'selected'
                    ? 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50'
                    : 'border-gray-300 bg-gradient-to-br from-gray-50 to-slate-50'
                }`}>
                  <div className="p-6 sm:p-8 text-center">
                    <div className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4">
                      {student.application?.results?.status === 'selected' ? '🎉' : '📝'}
                    </div>
                    <h3 className={`text-2xl sm:text-3xl font-bold mb-2 px-4 ${
                      student.application?.results?.status === 'selected'
                        ? 'text-green-900'
                        : 'text-gray-900'
                    }`}>
                      {student.application?.results?.status === 'selected'
                        ? 'Congratulations!'
                        : 'Results Published'}
                    </h3>
                    <p className="text-sm sm:text-base text-gray-700 mb-4 sm:mb-6 max-w-md mx-auto px-4">
                      {student.application?.results?.status === 'selected'
                        ? 'You have been selected! View your detailed evaluation results below.'
                        : 'Your evaluation has been completed. Review the feedback to improve future applications.'}
                    </p>
                    <button
                      onClick={() => router.push('/student/applications')}
                      className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 min-h-[48px] px-5 sm:px-6 py-3 rounded-lg font-medium shadow-md hover:shadow-lg transition-all text-sm sm:text-base touch-manipulation ${
                        student.application?.results?.status === 'selected'
                          ? 'bg-green-600 text-white hover:bg-green-700'
                          : 'bg-gray-700 text-white hover:bg-gray-800'
                      }`}
                    >
                      <Award className="h-4 w-4 sm:h-5 sm:w-5" />
                      View Results
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Sidebar */}
            <div className="space-y-4 sm:space-y-6">
              {/* Admission Info Card */}
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="p-4 sm:p-6">
                  <div className="flex items-center gap-3 mb-3 sm:mb-4">
                    {admissionInfo?.is_open ? (
                      <Unlock className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                    ) : (
                      <Lock className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600" />
                    )}
                    <h3 className="text-base sm:text-lg font-bold text-gray-900">Admission Status</h3>
                  </div>

                  {admissionInfo ? (
                    admissionInfo.is_open ? (
                      <div className="space-y-3">
                        <div className="p-3 sm:p-4 bg-green-50 rounded-lg border border-green-200">
                          <p className="text-xs sm:text-sm font-semibold text-green-900 mb-1">
                            ✅ Applications Open
                          </p>
                          <p className="text-xs text-green-700">
                            {admissionInfo.cycle_name}
                          </p>
                        </div>
                        <div className="space-y-2 text-xs sm:text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Seats Available:</span>
                            <span className="font-semibold text-gray-900">
                              {admissionInfo.seats_available} / {admissionInfo.max_seats}
                            </span>
                          </div>
                          {admissionInfo.end_date && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">Deadline:</span>
                              <span className="font-semibold text-gray-900">
                                {new Date(admissionInfo.end_date).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-1">
                          🔒 Admissions Closed
                        </p>
                        <p className="text-xs text-gray-600">
                          Check back later for updates
                        </p>
                      </div>
                    )
                  ) : (
                    <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                      <p className="text-xs sm:text-sm text-gray-600">No information available</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-xl sm:rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
                <div className="p-4 sm:p-6">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <button
                      onClick={() => router.push('/student/applications')}
                      className="w-full flex items-center gap-3 p-3 sm:p-4 bg-gradient-to-r from-primary-50 to-indigo-50 rounded-lg hover:from-primary-100 hover:to-indigo-100 transition-all group min-h-[60px] touch-manipulation"
                    >
                      <div className="flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-primary-100 flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                        <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-semibold text-sm sm:text-base text-gray-900">My Applications</p>
                        <p className="text-xs text-gray-600">View history & results</p>
                      </div>
                      <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0" />
                    </button>

                    <button
                      onClick={() => router.push('/student/interviews')}
                      className="w-full flex items-center gap-3 p-3 sm:p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg hover:from-purple-100 hover:to-pink-100 transition-all group min-h-[60px] touch-manipulation"
                    >
                      <div className="flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                        <Video className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-semibold text-sm sm:text-base text-gray-900">My Interviews</p>
                        <p className="text-xs text-gray-600">Scheduled sessions</p>
                      </div>
                      <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0" />
                    </button>

                    <button
                      onClick={() => router.push('/verify')}
                      className="w-full flex items-center gap-3 p-3 sm:p-4 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg hover:from-gray-100 hover:to-slate-100 transition-all group min-h-[60px] touch-manipulation"
                    >
                      <div className="flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                        <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-semibold text-sm sm:text-base text-gray-900">Verify Results</p>
                        <p className="text-xs text-gray-600">Cryptographic proof</p>
                      </div>
                      <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0" />
                    </button>

                    <button
                      onClick={() => router.push('/dashboard')}
                      className="w-full flex items-center gap-3 p-3 sm:p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg hover:from-blue-100 hover:to-cyan-100 transition-all group min-h-[60px] touch-manipulation"
                    >
                      <div className="flex-shrink-0 h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                        <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-semibold text-sm sm:text-base text-gray-900">Public Dashboard</p>
                        <p className="text-xs text-gray-600">View statistics</p>
                      </div>
                      <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Help Card */}
              <div className="bg-gradient-to-br from-primary-600 to-indigo-700 rounded-xl sm:rounded-2xl shadow-lg p-4 sm:p-6 text-white">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="h-4 w-4 sm:h-5 sm:w-5" />
                  <h3 className="font-bold text-sm sm:text-base">Need Help?</h3>
                </div>
                <ul className="space-y-2 text-xs sm:text-sm text-white/90">
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0">•</span>
                    <span>Track your application status in real-time</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0">•</span>
                    <span>Verify results with cryptographic proof</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="flex-shrink-0">•</span>
                    <span>All evaluations are blind and anonymous</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
