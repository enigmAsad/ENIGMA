'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { adminApiClient, AdmissionCycle, InterviewDetails, InterviewCreate, ApplicationDetails } from '@/lib/adminApi';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import {
  Video, Calendar, Clock, CheckCircle2, XCircle, Trash2,
  AlertCircle, Loader2, Users, ChevronRight, UserCheck,
  CalendarPlus, Info, Mail, IdCard, Sparkles
} from 'lucide-react';

const AdminInterviewsPage = () => {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const [activeCycle, setActiveCycle] = useState<AdmissionCycle | null>(null);
  const [selectedApplicants, setSelectedApplicants] = useState<ApplicationDetails[]>([]);
  const [scheduledInterviews, setScheduledInterviews] = useState<InterviewDetails[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduleErrors, setScheduleErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setDataLoading(true);
        const allCycles = await adminApiClient.getAllCycles();

        const selectionCycle = allCycles.find(c => c.phase === 'selection');
        if (selectionCycle) {
          setActiveCycle(selectionCycle);
          const applicants = await adminApiClient.getCycleApplications(selectionCycle.cycle_id, 'shortlisted');
          setSelectedApplicants(applicants);
        }

        const validPhases = ['selection', 'published', 'completed'];
        const interviewCycles = allCycles.filter(c => validPhases.includes(c.phase));

        const interviewPromises = interviewCycles.map(cycle =>
          adminApiClient.getInterviewsForCycle(cycle.cycle_id)
        );

        const interviewsPerCycle = await Promise.all(interviewPromises);
        const allInterviews = interviewsPerCycle.flat();

        setScheduledInterviews(allInterviews);
      } catch (err) {
        setError('Failed to fetch data. Please try again.');
        console.error(err);
      } finally {
        setDataLoading(false);
      }
    };

    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const handleSchedule = async (applicationId: string, interviewTime: string): Promise<boolean> => {
    if (!activeCycle) return false;

    setScheduleErrors(prev => ({ ...prev, [applicationId]: '' }));

    try {
      const newInterview: InterviewCreate = {
        application_id: applicationId,
        interview_time: new Date(interviewTime).toISOString(),
      };
      const scheduled = await adminApiClient.scheduleInterview(newInterview);
      setScheduledInterviews([...scheduledInterviews, scheduled]);

      // Remove from selectedApplicants
      setSelectedApplicants(prev => prev.filter(app => app.application_id !== applicationId));
      return true;
    } catch (err: any) {
      const errorDetail = err.response?.data?.detail;
      let errorMessage = 'An unknown error occurred while scheduling.';
      if (typeof errorDetail === 'string') {
        errorMessage = errorDetail;
      } else if (Array.isArray(errorDetail)) {
        errorMessage = errorDetail.map(d => `${d.loc.join('.')} - ${d.msg}`).join(', ');
      }

      setScheduleErrors(prev => ({ ...prev, [applicationId]: errorMessage }));
      console.error(err);
      return false;
    }
  };

  const handleDelete = async (interviewId: number) => {
    if (window.confirm('Are you sure you want to delete this interview?')) {
      try {
        await adminApiClient.deleteInterview(interviewId);
        setScheduledInterviews(scheduledInterviews.filter(i => i.id !== interviewId));
      } catch (err) {
        alert('Failed to delete interview.');
        console.error('Failed to delete interview', err);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; icon: any; bg: string }> = {
      scheduled: { label: 'Scheduled', color: 'text-blue-700', icon: Calendar, bg: 'bg-blue-100' },
      completed: { label: 'Completed', color: 'text-green-700', icon: CheckCircle2, bg: 'bg-green-100' },
      cancelled: { label: 'Cancelled', color: 'text-red-700', icon: XCircle, bg: 'bg-red-100' },
      in_progress: { label: 'In Progress', color: 'text-purple-700', icon: Video, bg: 'bg-purple-100' },
    };
    return statusMap[status] || { label: status, color: 'text-gray-700', icon: Info, bg: 'bg-gray-100' };
  };

  if (dataLoading || authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading interview data...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-cyan-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-8 max-w-md">
          <div className="flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Error Loading Data</h3>
          <p className="text-gray-600 text-center mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full px-4 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-cyan-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 via-teal-700 to-cyan-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center">
              <Video className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-2">
                Interview Management
                <Sparkles className="h-7 w-7 text-yellow-300" />
              </h1>
              <p className="text-teal-100 mt-1">Schedule and manage applicant interviews</p>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <UserCheck className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-white/80 text-sm">Awaiting Schedule</p>
                  <p className="text-2xl font-bold text-white">{selectedApplicants.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-white/80 text-sm">Total Scheduled</p>
                  <p className="text-2xl font-bold text-white">{scheduledInterviews.length}</p>
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
                  <p className="text-2xl font-bold text-white">
                    {scheduledInterviews.filter(i => i.status === 'completed').length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Active Cycle Scheduling */}
        {activeCycle ? (
          <div className="mb-8">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-teal-500 to-cyan-600 px-6 py-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <CalendarPlus className="h-5 w-5" />
                  Schedule New Interviews - {activeCycle.cycle_name}
                </h2>
              </div>

              <div className="p-6">
                {selectedApplicants.length > 0 ? (
                  <div className="space-y-4">
                    {selectedApplicants.map(app => (
                      <div key={app.application_id} className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-200">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded-lg bg-teal-100 flex items-center justify-center">
                                <Users className="h-6 w-6 text-teal-600" />
                              </div>
                              <div>
                                <h3 className="font-bold text-gray-900">{app.name}</h3>
                                <p className="text-sm text-gray-600">Application ID: {app.application_id}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                              <Mail className="h-4 w-4" />
                              <span>{app.email}</span>
                            </div>
                          </div>

                          <div>
                            <ScheduleForm
                              applicationId={app.application_id}
                              onSchedule={handleSchedule}
                              error={scheduleErrors[app.application_id]}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 mb-4">
                      <UserCheck className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-600">No applicants awaiting interview scheduling.</p>
                    <p className="text-sm text-gray-500 mt-2">Complete the shortlisting phase to see applicants here.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border-2 border-yellow-300 p-8 mb-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 h-12 w-12 rounded-full bg-yellow-100 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Active Selection Cycle</h3>
                <p className="text-gray-600 mb-4">
                  There is no cycle in the 'selection' phase. Scheduling new interviews is currently disabled.
                </p>
                <button
                  onClick={() => router.push('/admin/cycles')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all font-medium shadow-md hover:shadow-lg"
                >
                  <Calendar className="h-4 w-4" />
                  Manage Cycles
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scheduled Interviews */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Scheduled Interviews
            </h2>
          </div>

          <div className="p-6">
            {scheduledInterviews.length > 0 ? (
              <div className="space-y-4">
                {scheduledInterviews.map(interview => {
                  const now = new Date();
                  const interviewTime = new Date(interview.interview_time);
                  const oneDay = 24 * 60 * 60 * 1000;
                  const isScheduled = interview.status === 'scheduled';
                  const isWithinWindow =
                    now.getTime() >= (interviewTime.getTime() - oneDay) &&
                    now.getTime() <= (interviewTime.getTime() + oneDay);

                  const isJoinable = isScheduled && isWithinWindow;
                  const statusBadge = getStatusBadge(interview.status);

                  return (
                    <div key={interview.id} className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-200">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                              <Video className="h-5 w-5 text-purple-600" />
                            </div>
                            <div>
                              <h3 className="font-bold text-gray-900">Interview #{interview.id}</h3>
                              <p className="text-sm text-gray-600">Application: {interview.application_id}</p>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                              <Clock className="h-4 w-4" />
                              <span>{interviewTime.toLocaleString('en-US', {
                                dateStyle: 'medium',
                                timeStyle: 'short'
                              })}</span>
                            </div>
                            <div className={`px-3 py-1 rounded-lg text-xs font-semibold ${statusBadge.bg} ${statusBadge.color} flex items-center gap-1`}>
                              <statusBadge.icon className="h-3 w-3" />
                              {statusBadge.label}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-2">
                          <button
                            onClick={() => router.push(`/interview/${interview.id}`)}
                            disabled={!isJoinable}
                            className={`px-5 py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                              isJoinable
                                ? 'bg-purple-600 text-white hover:bg-purple-700 shadow-md hover:shadow-lg'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            }`}
                          >
                            <Video className="h-4 w-4" />
                            {isJoinable ? 'Join Now' : 'Not Available'}
                          </button>
                          <button
                            onClick={() => handleDelete(interview.id)}
                            className="px-5 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all font-medium flex items-center justify-center gap-2"
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </div>
                      {!isJoinable && isScheduled && (
                        <p className="text-xs text-yellow-600 mt-3 flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          Joinable 24 hours before/after scheduled time
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 mb-4">
                  <Calendar className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-600">No interviews scheduled yet.</p>
                <p className="text-sm text-gray-500 mt-2">Schedule interviews for shortlisted applicants above.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ScheduleForm = ({ applicationId, onSchedule, error }: {
  applicationId: string;
  onSchedule: (applicationId: string, time: string) => Promise<boolean>;
  error?: string;
}) => {
  const [time, setTime] = useState('');
  const [scheduling, setScheduling] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setScheduling(true);
    const success = await onSchedule(applicationId, time);
    if (success) {
      setTime('');
    }
    setScheduling(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Interview Date & Time
        </label>
        <input
          type="datetime-local"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          required
          className="block w-full rounded-lg border border-gray-300 focus:border-teal-500 focus:ring-teal-500 px-3 py-2.5 text-sm"
        />
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
      <button
        type="submit"
        disabled={scheduling}
        className="w-full px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {scheduling ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Scheduling...
          </>
        ) : (
          <>
            <CalendarPlus className="h-4 w-4" />
            Schedule Interview
          </>
        )}
      </button>
    </form>
  );
};

export default AdminInterviewsPage;
