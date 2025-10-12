/**
 * Public fairness dashboard
 */

'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { apiClient, DashboardStatsResponse } from '@/lib/api';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await apiClient.getDashboardStats();
      setStats(data);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading && !stats) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-16">
          <div className="text-4xl mb-4">⏳</div>
          <p className="text-lg text-gray-600">Loading dashboard statistics...</p>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Card>
          <div className="text-center text-red-600">
            <div className="text-4xl mb-4">❌</div>
            <p className="text-lg">{error}</p>
            <Button onClick={fetchStats} className="mt-4">Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold mb-2">Fairness Dashboard</h1>
            <p className="text-lg text-gray-600">
              Public transparency metrics for ENIGMA Phase 1 evaluations
            </p>
          </div>
          <Button onClick={fetchStats} variant="outline" size="sm" isLoading={loading}>
            Refresh
          </Button>
        </div>
        {lastUpdated && (
          <p className="text-sm text-gray-500 mt-2">
            Last updated: {lastUpdated.toLocaleString()}
          </p>
        )}
      </div>

      {stats && (
        <>
          {/* Overview Stats */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Card>
              <div className="text-center">
                <div className="text-4xl mb-2">📝</div>
                <p className="text-sm text-gray-600 mb-1">Total Applications</p>
                <p className="text-4xl font-bold text-blue-600">{stats.total_applications}</p>
              </div>
            </Card>

            <Card>
              <div className="text-center">
                <div className="text-4xl mb-2">✅</div>
                <p className="text-sm text-gray-600 mb-1">Completed Evaluations</p>
                <p className="text-4xl font-bold text-green-600">{stats.completed_evaluations}</p>
              </div>
            </Card>

            <Card>
              <div className="text-center">
                <div className="text-4xl mb-2">📊</div>
                <p className="text-sm text-gray-600 mb-1">Average Score</p>
                <p className="text-4xl font-bold text-purple-600">
                  {stats.average_score !== null ? stats.average_score.toFixed(1) : 'N/A'}
                </p>
                {stats.average_score !== null && (
                  <p className="text-sm text-gray-500">out of 100</p>
                )}
              </div>
            </Card>
          </div>

          {/* Processing Pipeline */}
          <Card title="Processing Pipeline" subtitle="Current status of applications" className="mb-8">
            <div className="space-y-3">
              {Object.entries(stats.processing_stats).map(([status, count]) => {
                const total = stats.total_applications;
                const percentage = total > 0 ? (count / total) * 100 : 0;

                const statusLabels: Record<string, string> = {
                  submitted: 'Submitted',
                  identity_scrubbing: 'Identity Scrubbing',
                  worker_evaluation: 'AI Evaluation',
                  judge_review: 'Quality Review',
                  final_scoring: 'Final Scoring',
                  completed: 'Completed',
                  failed: 'Failed',
                };

                const statusColors: Record<string, string> = {
                  submitted: 'bg-blue-600',
                  identity_scrubbing: 'bg-purple-600',
                  worker_evaluation: 'bg-yellow-600',
                  judge_review: 'bg-orange-600',
                  final_scoring: 'bg-indigo-600',
                  completed: 'bg-green-600',
                  failed: 'bg-red-600',
                };

                return (
                  <div key={status}>
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-sm font-medium text-gray-700">
                        {statusLabels[status] || status}
                      </p>
                      <p className="text-sm text-gray-600">
                        {count} ({percentage.toFixed(1)}%)
                      </p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full ${statusColors[status] || 'bg-gray-600'}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Score Distribution */}
          <Card title="Score Distribution" subtitle="Distribution of final scores" className="mb-8">
            <div className="space-y-4">
              {Object.entries(stats.score_distribution).map(([range, count]) => {
                const total = stats.completed_evaluations;
                const percentage = total > 0 ? (count / total) * 100 : 0;

                const rangeColors: Record<string, string> = {
                  '90-100': 'bg-green-600',
                  '80-89': 'bg-blue-600',
                  '70-79': 'bg-yellow-600',
                  '60-69': 'bg-orange-600',
                  'below-60': 'bg-red-600',
                };

                const rangeEmojis: Record<string, string> = {
                  '90-100': '🌟',
                  '80-89': '✨',
                  '70-79': '⭐',
                  '60-69': '💫',
                  'below-60': '📌',
                };

                return (
                  <div key={range}>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span>{rangeEmojis[range]}</span>
                        <p className="font-medium text-gray-900">{range}</p>
                      </div>
                      <p className="text-sm text-gray-600">
                        {count} applicants ({percentage.toFixed(1)}%)
                      </p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-4">
                      <div
                        className={`h-4 rounded-full ${rangeColors[range]}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {stats.completed_evaluations === 0 && (
                <p className="text-center text-gray-500 py-8">
                  No completed evaluations yet
                </p>
              )}
            </div>
          </Card>

          {/* Fairness Metrics */}
          <Card title="Fairness Guarantees" subtitle="How ENIGMA ensures bias-free evaluation" className="mb-8">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start">
                  <span className="text-3xl mr-3">✅</span>
                  <div>
                    <h3 className="font-semibold text-green-900 mb-1">Blind Evaluation</h3>
                    <p className="text-sm text-green-800">
                      100% of applications undergo identity scrubbing before AI evaluation.
                      All names, demographics, and identifying information are removed.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start">
                  <span className="text-3xl mr-3">🤖</span>
                  <div>
                    <h3 className="font-semibold text-blue-900 mb-1">Worker-Judge Validation</h3>
                    <p className="text-sm text-blue-800">
                      Two-tier AI system with bias detection. Judge AI validates Worker AI
                      evaluations for quality and fairness before approval.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-start">
                  <span className="text-3xl mr-3">🔒</span>
                  <div>
                    <h3 className="font-semibold text-purple-900 mb-1">Cryptographic Audit</h3>
                    <p className="text-sm text-purple-800">
                      Every decision is hashed with SHA-256. Public verification portal allows
                      anyone to detect tampering.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start">
                  <span className="text-3xl mr-3">📊</span>
                  <div>
                    <h3 className="font-semibold text-orange-900 mb-1">Complete Transparency</h3>
                    <p className="text-sm text-orange-800">
                      All applicants receive detailed explanations, score breakdowns, strengths,
                      and areas for improvement.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* System Health */}
          <Card title="System Health" subtitle="Processing performance metrics">
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="text-3xl mb-2">⚡</div>
                <p className="text-sm text-gray-600 mb-1">Success Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {stats.total_applications > 0
                    ? ((stats.completed_evaluations / stats.total_applications) * 100).toFixed(1)
                    : '0'}%
                </p>
                <p className="text-xs text-gray-500">
                  {stats.completed_evaluations} / {stats.total_applications} completed
                </p>
              </div>

              <div className="text-center">
                <div className="text-3xl mb-2">🔄</div>
                <p className="text-sm text-gray-600 mb-1">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">
                  {stats.total_applications - stats.completed_evaluations}
                </p>
                <p className="text-xs text-gray-500">
                  Applications being processed
                </p>
              </div>

              <div className="text-center">
                <div className="text-3xl mb-2">🎯</div>
                <p className="text-sm text-gray-600 mb-1">Merit-Based</p>
                <p className="text-2xl font-bold text-purple-600">100%</p>
                <p className="text-xs text-gray-500">
                  No demographic factors considered
                </p>
              </div>
            </div>
          </Card>

          {/* About Phase 1 */}
          <Card title="About Phase 1 Evaluation">
            <div className="prose prose-sm max-w-none text-gray-700">
              <p>
                <strong>Phase 1</strong> is ENIGMA's blind AI screening stage. Every application
                goes through the following process:
              </p>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>
                  <strong>Identity Scrubbing:</strong> All personally identifiable information
                  (name, contact info, demographics) is removed from the application.
                </li>
                <li>
                  <strong>Worker AI Evaluation:</strong> An AI evaluates academic performance,
                  test scores, achievements, and essay quality based purely on merit.
                </li>
                <li>
                  <strong>Judge AI Validation:</strong> A second AI reviews the Worker's evaluation
                  for bias, quality, and rubric adherence.
                </li>
                <li>
                  <strong>Retry Loop:</strong> If the Judge detects issues, the Worker re-evaluates
                  with feedback (up to 3 attempts).
                </li>
                <li>
                  <strong>Final Scoring:</strong> Approved scores are aggregated and hashed for
                  cryptographic verification.
                </li>
              </ol>
              <p className="mt-4">
                This process ensures every applicant is judged solely on their academic merit,
                with complete transparency and accountability.
              </p>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
