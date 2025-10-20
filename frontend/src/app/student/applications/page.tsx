'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useStudentAuth';
import { studentApiClient, type StudentApplicationHistory } from '@/lib/studentApi';
import { SkeletonList } from '@/components/Skeleton';
import {
  FileText, ChevronDown, ChevronUp, Award, TrendingUp,
  Calendar, Clock, CheckCircle2, AlertCircle, Shield,
  Loader2, ArrowRight, Search, Filter, Eye, EyeOff,
  BarChart3, Target, Sparkles, Info
} from 'lucide-react';

export default function StudentApplicationsPage() {
  const router = useRouter();
  const { student } = useAuth();
  const [applications, setApplications] = useState<StudentApplicationHistory[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!student && !loading) {
      router.push('/student/login');
    }
  }, [student, loading, router]);

  // Fetch applications
  useEffect(() => {
    const fetchApplications = async () => {
      try {
        setLoading(true);
        const response = await studentApiClient.getApplications();
        setApplications(response.applications);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load applications');
      } finally {
        setLoading(false);
      }
    };

    if (student) {
      fetchApplications();
    }
  }, [student]);

  const toggleExpand = (applicationId: string) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(applicationId)) {
        newSet.delete(applicationId);
      } else {
        newSet.add(applicationId);
      }
      return newSet;
    });
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; bg: string; icon: any }> = {
      selected: { label: 'Selected', color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle2 },
      not_selected: { label: 'Not Selected', color: 'text-gray-700', bg: 'bg-gray-100', icon: AlertCircle },
      published: { label: 'Published', color: 'text-primary-700', bg: 'bg-primary-100', icon: FileText },
      submitted: { label: 'Submitted', color: 'text-blue-700', bg: 'bg-blue-100', icon: Clock },
      preprocessing: { label: 'Pre-processing', color: 'text-yellow-700', bg: 'bg-yellow-100', icon: Loader2 },
      processing: { label: 'Processing', color: 'text-purple-700', bg: 'bg-purple-100', icon: TrendingUp },
      scored: { label: 'Scored', color: 'text-indigo-700', bg: 'bg-indigo-100', icon: Award },
    };
    return statusMap[status.toLowerCase()] || { label: status, color: 'text-gray-700', bg: 'bg-gray-100', icon: FileText };
  };

  const getPhaseBadge = (phase: string) => {
    const phaseMap: Record<string, { color: string; bg: string }> = {
      completed: { color: 'text-gray-100', bg: 'bg-gray-500' },
      published: { color: 'text-white', bg: 'bg-primary-600' },
      selection: { color: 'text-white', bg: 'bg-indigo-600' },
      scored: { color: 'text-white', bg: 'bg-indigo-600' },
      processing: { color: 'text-white', bg: 'bg-purple-600' },
      submission: { color: 'text-white', bg: 'bg-green-600' },
    };
    return phaseMap[phase.toLowerCase()] || { color: 'text-white', bg: 'bg-gray-600' };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Filter applications
  const filteredApplications = applications.filter(app => {
    if (filterStatus === 'all') return true;
    return app.status.toLowerCase() === filterStatus.toLowerCase();
  });

  if (!student) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-primary-50 to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <SkeletonList items={3} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-primary-50 to-indigo-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center">
              <FileText className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-2">
                My Applications
                <Sparkles className="h-7 w-7 text-yellow-300" />
              </h1>
              <p className="text-primary-100 mt-1">Track all your submissions and results</p>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mt-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-white/80 text-sm">Total Applications</p>
                  <p className="text-2xl font-bold text-white">{applications.length}</p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-white/80 text-sm">Selected</p>
                  <p className="text-2xl font-bold text-white">
                    {applications.filter(a => a.status.toLowerCase() === 'selected').length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-white/80 text-sm">In Progress</p>
                  <p className="text-2xl font-bold text-white">
                    {applications.filter(a => !['selected', 'not_selected', 'published'].includes(a.status.toLowerCase())).length}
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                  <Award className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-white/80 text-sm">Completed</p>
                  <p className="text-2xl font-bold text-white">
                    {applications.filter(a => a.results !== null).length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Error State */}
        {error && (
          <div className="mb-6 bg-white rounded-2xl border-2 border-red-200 p-6 shadow-lg">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 mb-1">Error Loading Applications</h3>
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && !error && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl shadow-lg p-8 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        )}

        {/* Applications List */}
        {!loading && !error && applications.length === 0 && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-primary-100 mb-6">
                <FileText className="h-10 w-10 text-primary-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-3">No Applications Yet</h2>
              <p className="text-gray-600 mb-8 max-w-md mx-auto">
                You haven't submitted any applications. Check if admissions are open and apply now!
              </p>
              <button
                onClick={() => router.push('/')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all font-medium shadow-md hover:shadow-lg"
              >
                Go to Home
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {!loading && !error && applications.length > 0 && (
          <div className="space-y-6">
            {/* Filter Bar */}
            <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Filter className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Filter by status:</span>
                <div className="flex flex-wrap gap-2">
                  {['all', 'selected', 'not_selected', 'submitted', 'scored'].map(status => (
                    <button
                      key={status}
                      onClick={() => setFilterStatus(status)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        filterStatus === status
                          ? 'bg-primary-600 text-white shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Applications */}
            {filteredApplications.map((app) => {
              const isExpanded = expandedIds.has(app.application_id);
              const hasResults = app.results !== null;
              const statusBadge = getStatusBadge(app.status);
              const phaseBadge = getPhaseBadge(app.cycle.phase);

              return (
                <div
                  key={app.application_id}
                  className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden hover:shadow-xl transition-all duration-300"
                >
                  {/* Card Header - Always Visible */}
                  <div className="p-6 bg-gradient-to-r from-gray-50 to-slate-50">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                          <h3 className="text-2xl font-bold text-gray-900">
                            {app.cycle.cycle_name}
                          </h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${phaseBadge.color} ${phaseBadge.bg}`}>
                            {app.cycle.phase.replace('_', ' ').toUpperCase()}
                          </span>
                          <div className={`px-3 py-1 rounded-lg text-sm font-semibold ${statusBadge.bg} ${statusBadge.color} flex items-center gap-2`}>
                            <statusBadge.icon className="h-4 w-4" />
                            {statusBadge.label}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>Submitted: {formatDate(app.submitted_at)}</span>
                          </div>
                          {app.anonymized_id && (
                            <>
                              <span className="text-gray-400">•</span>
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4" />
                                <span className="font-mono text-xs">{app.anonymized_id}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => toggleExpand(app.application_id)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all font-medium shadow-md hover:shadow-lg self-start lg:self-auto"
                      >
                        {isExpanded ? (
                          <>
                            <EyeOff className="h-4 w-4" />
                            Hide Details
                            <ChevronUp className="h-4 w-4" />
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4" />
                            View Details
                            <ChevronDown className="h-4 w-4" />
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t-2 border-gray-100 p-6 bg-white">
                      {/* Cycle Details */}
                      <div className="mb-8">
                        <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                          <Info className="h-4 w-4" />
                          Cycle Information
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                            <p className="text-xs text-blue-600 font-medium mb-1">Start Date</p>
                            <p className="text-sm font-bold text-blue-900">
                              {formatDate(app.cycle.start_date)}
                            </p>
                          </div>
                          <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                            <p className="text-xs text-purple-600 font-medium mb-1">End Date</p>
                            <p className="text-sm font-bold text-purple-900">
                              {formatDate(app.cycle.end_date)}
                            </p>
                          </div>
                          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                            <p className="text-xs text-green-600 font-medium mb-1">Results Date</p>
                            <p className="text-sm font-bold text-green-900">
                              {formatDate(app.cycle.result_date)}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Results Section */}
                      {hasResults && app.results ? (
                        <div className="space-y-6">
                          {/* Selection Decision Banner */}
                          {app.results.status.toLowerCase() === 'selected' && (
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400 rounded-2xl p-8 shadow-lg">
                              <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                                  <span className="text-4xl">🎉</span>
                                </div>
                                <div className="flex-1">
                                  <h3 className="text-2xl font-bold text-green-900 mb-2">
                                    Congratulations! You've been selected!
                                  </h3>
                                  <p className="text-green-800">
                                    Your application has been accepted. View your detailed evaluation below.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {app.results.status.toLowerCase() === 'not_selected' && (
                            <div className="bg-gradient-to-r from-gray-50 to-slate-50 border-2 border-gray-300 rounded-2xl p-8 shadow-lg">
                              <div className="flex items-start gap-4">
                                <div className="flex-shrink-0 h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center">
                                  <span className="text-4xl">📝</span>
                                </div>
                                <div className="flex-1">
                                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                                    Application Not Selected
                                  </h3>
                                  <p className="text-gray-700">
                                    We appreciate your interest. Review your evaluation feedback below to strengthen future applications.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Score Overview */}
                          <div className="bg-gradient-to-br from-primary-50 to-indigo-50 rounded-2xl p-8 border-2 border-primary-200 shadow-lg">
                            <h4 className="text-lg font-bold text-gray-900 uppercase tracking-wide mb-6 flex items-center gap-2">
                              <BarChart3 className="h-5 w-5 text-primary-600" />
                              Evaluation Results
                            </h4>
                            <div className="bg-white rounded-xl p-6 shadow-md">
                              <div className="text-center mb-6">
                                <p className="text-sm text-gray-600 mb-2 font-medium">Final Score</p>
                                <p className="text-6xl font-bold text-primary-600">
                                  {app.results.final_score.toFixed(1)}
                                </p>
                                <p className="text-sm text-gray-500 mt-1">out of 100</p>
                              </div>

                              {/* Score Breakdown */}
                              <div className="space-y-4">
                                {[
                                  { label: 'Academic', score: app.results.academic_score, color: 'bg-blue-600' },
                                  { label: 'Test Scores', score: app.results.test_score, color: 'bg-purple-600' },
                                  { label: 'Achievements', score: app.results.achievement_score, color: 'bg-green-600' },
                                  { label: 'Essay', score: app.results.essay_score, color: 'bg-orange-600' },
                                ].map((item) => (
                                  <div key={item.label}>
                                    <div className="flex justify-between text-sm mb-2">
                                      <span className="font-semibold text-gray-700">{item.label}</span>
                                      <span className="font-bold text-gray-900">{item.score.toFixed(1)}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                                      <div
                                        className={`h-3 rounded-full transition-all duration-500 ${item.color}`}
                                        style={{ width: `${item.score}%` }}
                                      ></div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* AI Explanation */}
                          {app.results.explanation && (
                            <div>
                              <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                                <Target className="h-4 w-4" />
                                Evaluator Commentary
                              </h4>
                              <div className="bg-white rounded-xl p-6 border-2 border-gray-200 shadow-md">
                                <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">
                                  {app.results.explanation}
                                </p>
                              </div>
                            </div>
                          )}

                          {/* Strengths & Improvements */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {app.results.strengths && app.results.strengths.length > 0 && (
                              <div>
                                <h4 className="text-sm font-bold text-green-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                                  <CheckCircle2 className="h-4 w-4" />
                                  Strengths
                                </h4>
                                <div className="bg-green-50 rounded-xl p-5 border-2 border-green-200 shadow-md">
                                  <ul className="space-y-2">
                                    {app.results.strengths.map((strength, idx) => (
                                      <li key={idx} className="text-sm text-green-900 flex items-start gap-2">
                                        <span className="text-green-600 font-bold mt-0.5">✓</span>
                                        <span>{strength}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            )}

                            {app.results.areas_for_improvement &&
                              app.results.areas_for_improvement.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-bold text-orange-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4" />
                                    Areas for Improvement
                                  </h4>
                                  <div className="bg-orange-50 rounded-xl p-5 border-2 border-orange-200 shadow-md">
                                    <ul className="space-y-2">
                                      {app.results.areas_for_improvement.map((area, idx) => (
                                        <li key={idx} className="text-sm text-orange-900 flex items-start gap-2">
                                          <span className="text-orange-600 font-bold mt-0.5">→</span>
                                          <span>{area}</span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                </div>
                              )}
                          </div>

                          {/* Hash Verification */}
                          {app.results.hash && (
                            <div>
                              <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                                <Shield className="h-4 w-4" />
                                Cryptographic Verification
                              </h4>
                              <div className="bg-gray-100 rounded-xl p-5 border-2 border-gray-300 shadow-md">
                                <p className="text-xs text-gray-600 mb-2 font-medium">Decision Hash (SHA-256)</p>
                                <p className="font-mono text-xs text-gray-800 break-all bg-white p-3 rounded border border-gray-200">
                                  {app.results.hash}
                                </p>
                                <button
                                  onClick={() =>
                                    router.push(
                                      `/verify?id=${app.anonymized_id}&hash=${app.results?.hash}`
                                    )
                                  }
                                  className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-all font-medium shadow-md hover:shadow-lg"
                                >
                                  <Shield className="h-4 w-4" />
                                  Verify Hash
                                  <ArrowRight className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-12 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200">
                          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
                            <Clock className="h-8 w-8 text-blue-600" />
                          </div>
                          <p className="text-lg font-bold text-gray-900 mb-2">
                            Evaluation in Progress
                          </p>
                          <p className="text-sm text-gray-600 mb-1">
                            Results will be available once the admission cycle completes evaluation and publishes results.
                          </p>
                          <p className="text-xs text-gray-500 mt-3">
                            Expected results: {formatDate(app.cycle.result_date)}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
