'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useStudentAuth';
import { studentApiClient, type StudentApplicationHistory } from '@/lib/studentApi';
import Card from '@/components/Card';
import Button from '@/components/Button';

export default function StudentApplicationsPage() {
  const router = useRouter();
  const { student } = useAuth();
  const [applications, setApplications] = useState<StudentApplicationHistory[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const getStatusBadgeColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'selected') return 'bg-green-100 text-green-800';
    if (statusLower === 'not_selected') return 'bg-gray-100 text-gray-800';
    if (statusLower === 'published') return 'bg-primary-100 text-primary-800';
    if (statusLower === 'submitted') return 'bg-yellow-100 text-yellow-800';
    if (statusLower === 'processing' || statusLower === 'preprocessing') return 'bg-purple-100 text-purple-800';
    if (statusLower === 'scored') return 'bg-indigo-100 text-indigo-800';
    return 'bg-gray-100 text-gray-800';
  };

  const getPhaseBadgeColor = (phase: string) => {
    const phaseLower = phase.toLowerCase();
    if (phaseLower === 'completed') return 'bg-gray-500 text-white';
    if (phaseLower === 'published') return 'bg-primary-600 text-white';
    if (phaseLower === 'selection' || phaseLower === 'scored') return 'bg-indigo-600 text-white';
    if (phaseLower === 'processing') return 'bg-purple-600 text-white';
    if (phaseLower === 'submission') return 'bg-green-600 text-white';
    return 'bg-gray-600 text-white';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (!student) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Application History</h1>
          <p className="mt-2 text-gray-600">
            View all your applications across different admission cycles
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Loading State */}
        {loading && !error && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        )}

        {/* Applications List */}
        {!loading && !error && applications.length === 0 && (
          <Card>
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">No applications yet</h3>
              <p className="mt-2 text-gray-500">
                You haven't submitted any applications. Check if admissions are open!
              </p>
              <Button variant="primary" className="mt-6" onClick={() => router.push('/')}>
                Go to Home
              </Button>
            </div>
          </Card>
        )}

        {!loading && !error && applications.length > 0 && (
          <div className="space-y-4">
            {applications.map((app) => {
              const isExpanded = expandedIds.has(app.application_id);
              const hasResults = app.results !== null;

              return (
                <div
                  key={app.application_id}
                  className="bg-white rounded-lg shadow hover:shadow-md transition-shadow"
                >
                  {/* Card Header - Always Visible */}
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold text-gray-900">
                            {app.cycle.cycle_name}
                          </h3>
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${getPhaseBadgeColor(
                              app.cycle.phase
                            )}`}
                          >
                            {app.cycle.phase.replace('_', ' ')}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                          <span>Submitted: {formatDate(app.submitted_at)}</span>
                          <span className="text-gray-400">•</span>
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadgeColor(
                              app.status
                            )}`}
                          >
                            {app.status.replace('_', ' ')}
                          </span>
                          {app.anonymized_id && (
                            <>
                              <span className="text-gray-400">•</span>
                              <span className="text-xs text-gray-500">
                                ID: {app.anonymized_id}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleExpand(app.application_id)}
                      >
                        {isExpanded ? 'Collapse' : 'Expand'}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 p-6 bg-gray-50">
                      {/* Cycle Details */}
                      <div className="mb-6">
                        <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                          Cycle Information
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div>
                            <p className="text-xs text-gray-500">Start Date</p>
                            <p className="text-sm font-medium text-gray-900">
                              {formatDate(app.cycle.start_date)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">End Date</p>
                            <p className="text-sm font-medium text-gray-900">
                              {formatDate(app.cycle.end_date)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Results Date</p>
                            <p className="text-sm font-medium text-gray-900">
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
                            <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-500 rounded-lg p-6">
                              <div className="flex items-start">
                                <div className="flex-shrink-0">
                                  <span className="text-4xl">🎉</span>
                                </div>
                                <div className="ml-4">
                                  <h3 className="text-xl font-bold text-green-900">
                                    Congratulations! You've been selected!
                                  </h3>
                                  <p className="mt-2 text-green-800">
                                    Your application has been accepted. View your detailed evaluation below.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {app.results.status.toLowerCase() === 'not_selected' && (
                            <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-400 rounded-lg p-6">
                              <div className="flex items-start">
                                <div className="flex-shrink-0">
                                  <span className="text-4xl">📝</span>
                                </div>
                                <div className="ml-4">
                                  <h3 className="text-xl font-bold text-gray-900">
                                    Application Not Selected
                                  </h3>
                                  <p className="mt-2 text-gray-700">
                                    We appreciate your interest. Review your evaluation feedback below to strengthen future applications.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Score Overview */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                              Evaluation Results
                            </h4>
                            <div className="bg-white rounded-lg p-6 border border-gray-200">
                              <div className="text-center mb-6">
                                <p className="text-sm text-gray-600 mb-2">Final Score</p>
                                <p className="text-5xl font-bold text-primary-600">
                                  {app.results.final_score.toFixed(1)}
                                </p>
                                <p className="text-sm text-gray-500 mt-1">out of 100</p>
                              </div>

                              {/* Score Breakdown */}
                              <div className="space-y-4">
                                {[
                                  { label: 'Academic', score: app.results.academic_score },
                                  { label: 'Test Scores', score: app.results.test_score },
                                  { label: 'Achievements', score: app.results.achievement_score },
                                  { label: 'Essay', score: app.results.essay_score },
                                ].map((item) => (
                                  <div key={item.label}>
                                    <div className="flex justify-between text-sm mb-1">
                                      <span className="font-medium text-gray-700">{item.label}</span>
                                      <span className="text-gray-900">{item.score.toFixed(1)}</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2">
                                      <div
                                        className="bg-primary-600 h-2 rounded-full transition-all"
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
                              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                                Evaluator Commentary
                              </h4>
                              <div className="bg-white rounded-lg p-6 border border-gray-200">
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
                                <h4 className="text-sm font-semibold text-green-700 uppercase tracking-wide mb-3">
                                  ✓ Strengths
                                </h4>
                                <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                                  <ul className="space-y-2">
                                    {app.results.strengths.map((strength, idx) => (
                                      <li key={idx} className="text-sm text-green-900 flex items-start">
                                        <span className="mr-2">•</span>
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
                                  <h4 className="text-sm font-semibold text-orange-700 uppercase tracking-wide mb-3">
                                    ⚠ Areas for Improvement
                                  </h4>
                                  <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                                    <ul className="space-y-2">
                                      {app.results.areas_for_improvement.map((area, idx) => (
                                        <li key={idx} className="text-sm text-orange-900 flex items-start">
                                          <span className="mr-2">•</span>
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
                              <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                                Cryptographic Verification
                              </h4>
                              <div className="bg-gray-100 rounded-lg p-4 border border-gray-300">
                                <p className="text-xs text-gray-600 mb-1">Decision Hash (SHA-256)</p>
                                <p className="font-mono text-xs text-gray-800 break-all">
                                  {app.results.hash}
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="mt-3"
                                  onClick={() =>
                                    router.push(
                                      `/verify?id=${app.anonymized_id}&hash=${app.results?.hash}`
                                    )
                                  }
                                >
                                  Verify Hash
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <svg
                            className="mx-auto h-12 w-12 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          <p className="mt-4 text-gray-600 font-medium">
                            Evaluation in Progress
                          </p>
                          <p className="mt-2 text-sm text-gray-500">
                            Results will be available once the admission cycle completes evaluation and publishes results.
                          </p>
                          <p className="mt-2 text-xs text-gray-400">
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
