/**
 * Application status and results viewer
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Card from '@/components/Card';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { apiClient, ApplicationStatusResponse, ResultsResponse } from '@/lib/api';

function StatusContent() {
  const searchParams = useSearchParams();
  const urlId = searchParams.get('id');

  const [applicationId, setApplicationId] = useState(urlId || '');
  const [status, setStatus] = useState<ApplicationStatusResponse | null>(null);
  const [results, setResults] = useState<ResultsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkStatus = async (id: string) => {
    if (!id.trim()) {
      setError('Please enter an application ID');
      return;
    }

    setLoading(true);
    setError(null);
    setStatus(null);
    setResults(null);

    try {
      const statusData = await apiClient.getApplicationStatus(id);
      setStatus(statusData);

      // If published/selected/not_selected, try to fetch results
      const resultsAvailableStatuses = ['published', 'selected', 'not_selected'];
      if (resultsAvailableStatuses.includes(statusData.status) && statusData.anonymized_id) {
        try {
          const resultsData = await apiClient.getResults(statusData.anonymized_id);
          setResults(resultsData);
        } catch (err: any) {
          console.error('Failed to fetch results:', err);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to check status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (urlId) {
      checkStatus(urlId);
    }
  }, [urlId]);

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      submitted: 'bg-blue-100 text-blue-800',
      finalized: 'bg-indigo-100 text-indigo-800',
      preprocessing: 'bg-purple-100 text-purple-800',
      batch_ready: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-orange-100 text-orange-800',
      scored: 'bg-sky-100 text-sky-800',
      selected: 'bg-green-100 text-green-800',
      not_selected: 'bg-gray-100 text-gray-800',
      published: 'bg-emerald-100 text-emerald-800',
      failed: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusEmoji = (status: string) => {
    const emojis: Record<string, string> = {
      submitted: '📝',
      finalized: '🗃️',
      preprocessing: '🧮',
      batch_ready: '📤',
      processing: '⚙️',
      scored: '📈',
      selected: '🎉',
      not_selected: '📬',
      published: '✅',
      failed: '❌',
    };
    return emojis[status] || '⏳';
  };

  const renderStatusMessage = (currentStatus: string, message: string) => {
    const waitingStatuses = ['submitted', 'finalized', 'preprocessing', 'batch_ready', 'processing', 'scored'];
    const finalStatuses = ['selected', 'not_selected', 'published'];

    if (waitingStatuses.includes(currentStatus)) {
      return (
        <div className="space-y-2">
          <p className="text-gray-700">{message}</p>
          <p className="text-sm text-gray-500">
            Your application is still progressing through the evaluation workflow. You can check back later using the same Application ID.
          </p>
        </div>
      );
    }

    if (finalStatuses.includes(currentStatus)) {
      return <p className="text-gray-700">{message}</p>;
    }

    if (currentStatus === 'published') {
      return <p className="text-gray-700">{message}</p>;
    }

    if (currentStatus === 'failed') {
      return (
        <div className="space-y-2">
          <p className="text-gray-700">{message}</p>
          <p className="text-sm text-gray-500">Please reach out to admissions support for assistance.</p>
        </div>
      );
    }

    return <p className="text-gray-700">{message}</p>;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-4 text-white">Check Application Status</h1>
        <p className="text-lg text-gray-600 text-white">
          Enter your Application ID to view your evaluation status and results
        </p>
      </div>

      {/* Search Form */}
      <Card className="mb-8">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            checkStatus(applicationId);
          }}
          className="flex gap-4"
        >
          <Input
            label="Application ID"
            type="text"
            value={applicationId}
            onChange={(e) => setApplicationId(e.target.value)}
            placeholder="APP_XXXXXXXX"
            className="flex-1"
          />
          <div className="flex items-end">
            <Button type="submit" isLoading={loading} disabled={loading}>
              Check Status
            </Button>
          </div>
        </form>
      </Card>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Status Display */}
      {status && (
        <>
          <Card title="Application Status" className="mb-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Application ID</p>
                  <p className="text-lg font-mono font-bold">{status.application_id}</p>
                </div>
                {status.anonymized_id && (
                  <div>
                    <p className="text-sm text-gray-600">Anonymized ID</p>
                    <p className="text-lg font-mono font-bold">{status.anonymized_id}</p>
                  </div>
                )}
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-2">Current Status</p>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{getStatusEmoji(status.status)}</span>
                  <span className={`px-4 py-2 rounded-lg font-medium ${getStatusColor(status.status)}`}>
                    {status.status.replace(/_/g, ' ').toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                {renderStatusMessage(status.status, status.message)}
              </div>

              <div className="text-xs text-gray-500">
                Last updated: {new Date(status.timestamp).toLocaleString()}
              </div>
            </div>
          </Card>

          {/* Results Display */}
          {results && (
            <>
              {/* Selection Result Banner */}
              {results.status === 'selected' && (
                <div className="mb-8 p-8 bg-gradient-to-r from-green-50 to-emerald-50 border-4 border-green-400 rounded-xl shadow-lg">
                  <div className="text-center">
                    <div className="text-6xl mb-4">🎉</div>
                    <h2 className="text-3xl font-bold text-green-800 mb-2">
                      Congratulations! You've Been Selected!
                    </h2>
                    <p className="text-lg text-green-700">
                      You have been chosen for admission. Further details will be sent to your email address.
                    </p>
                  </div>
                </div>
              )}

              {results.status === 'not_selected' && (
                <div className="mb-8 p-8 bg-gradient-to-r from-gray-50 to-slate-50 border-4 border-gray-400 rounded-xl shadow-lg">
                  <div className="text-center">
                    <div className="text-6xl mb-4">📬</div>
                    <h2 className="text-3xl font-bold text-gray-800 mb-2">
                      Thank You for Your Application
                    </h2>
                    <p className="text-lg text-gray-700 mb-4">
                      After careful consideration, we regret to inform you that you were not selected in this admission cycle.
                    </p>
                    <p className="text-md text-gray-600">
                      We appreciate your interest and encourage you to review your evaluation feedback below.
                    </p>
                  </div>
                </div>
              )}

              {/* Score Overview */}
              <Card title="Evaluation Results" className="mb-8">
                <div className="space-y-6">
                  {/* Final Score */}
                  <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
                    <p className="text-sm text-gray-600 mb-2">Final Score</p>
                    <p className="text-6xl font-bold text-blue-600 mb-2">
                      {results.final_score.toFixed(1)}
                    </p>
                    <p className="text-lg text-gray-700">out of 100</p>
                  </div>

                  {/* Score Breakdown */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Academic Performance</p>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 bg-gray-200 rounded-full h-3 mr-3">
                          <div
                            className="bg-blue-600 h-3 rounded-full"
                            style={{ width: `${results.academic_score}%` }}
                          />
                        </div>
                        <p className="text-lg font-bold text-blue-600">
                          {results.academic_score.toFixed(1)}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Test Scores</p>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 bg-gray-200 rounded-full h-3 mr-3">
                          <div
                            className="bg-green-600 h-3 rounded-full"
                            style={{ width: `${results.test_score}%` }}
                          />
                        </div>
                        <p className="text-lg font-bold text-green-600">
                          {results.test_score.toFixed(1)}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Achievements</p>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 bg-gray-200 rounded-full h-3 mr-3">
                          <div
                            className="bg-purple-600 h-3 rounded-full"
                            style={{ width: `${results.achievement_score}%` }}
                          />
                        </div>
                        <p className="text-lg font-bold text-purple-600">
                          {results.achievement_score.toFixed(1)}
                        </p>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Essay Quality</p>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 bg-gray-200 rounded-full h-3 mr-3">
                          <div
                            className="bg-orange-600 h-3 rounded-full"
                            style={{ width: `${results.essay_score}%` }}
                          />
                        </div>
                        <p className="text-lg font-bold text-orange-600">
                          {results.essay_score.toFixed(1)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Explanation */}
              <Card title="Evaluation Explanation" className="mb-8">
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {results.explanation}
                </p>
              </Card>

              {/* Strengths */}
              <Card title="Key Strengths" className="mb-8">
                <ul className="space-y-3">
                  {results.strengths.map((strength, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-green-600 mr-3 text-xl">✓</span>
                      <span className="text-gray-700">{strength}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              {/* Areas for Improvement */}
              <Card title="Areas for Improvement" className="mb-8">
                <ul className="space-y-3">
                  {results.areas_for_improvement.map((area, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-blue-600 mr-3 text-xl">→</span>
                      <span className="text-gray-700">{area}</span>
                    </li>
                  ))}
                </ul>
              </Card>

              {/* Verification */}
              <Card title="Cryptographic Verification" className="mb-8">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">Decision Hash (SHA-256)</p>
                    <p className="font-mono text-xs bg-gray-50 p-3 rounded break-all">
                      {results.hash}
                    </p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900 mb-2">
                      <strong>What is this hash?</strong>
                    </p>
                    <p className="text-sm text-blue-800">
                      This cryptographic hash proves the integrity of your evaluation.
                      Any tampering with the decision data will change the hash, making
                      modifications immediately detectable.
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Link href={`/verify?id=${results.anonymized_id}&hash=${results.hash}`} className="flex-1">
                      <Button className="w-full">
                        Verify This Decision
                      </Button>
                    </Link>
                  </div>

                  <div className="text-sm text-gray-600">
                    <p>Evaluation completed: {new Date(results.timestamp).toLocaleString()}</p>
                    <p>Worker attempts: {results.worker_attempts}</p>
                  </div>
                </div>
              </Card>
            </>
          )}
        </>
      )}

      {/* Help Text */}
      {!status && !loading && (
        <Card>
          <div className="text-center text-gray-600">
            <p className="text-4xl mb-4">🔍</p>
            <p className="text-lg">
              Enter your Application ID above to check your status and view results.
            </p>
            <p className="text-sm mt-2">
              Your Application ID was provided when you submitted your application.
            </p>
            <p className="text-sm mt-2 text-gray-500">
              Results appear once the admissions team publishes final decisions. If you recently submitted, please allow time for processing.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}

export default function StatusPage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-8 text-center">Loading...</div>}>
      <StatusContent />
    </Suspense>
  );
}
