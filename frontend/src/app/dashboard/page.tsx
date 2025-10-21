/**
 * Public fairness dashboard
 */

'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/Card';
import Button from '@/components/Button';
import { apiClient, DashboardStatsResponse } from '@/lib/api';
import { SkeletonDashboard } from '@/components/Skeleton';
import {
  FileText, CheckCircle2, BarChart3, RefreshCw, Shield, Lock,
  Eye, Award, Zap, TrendingUp, Users, Clock, Star, Sparkles,
  Activity, Target, Database, Loader2, AlertCircle, ChevronRight
} from 'lucide-react';

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <SkeletonDashboard />
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl border border-gray-200 p-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Unable to Load Data</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={fetchStats}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-primary-600 to-indigo-600 text-white rounded-xl font-semibold hover:from-primary-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl hover:scale-105"
            >
              <RefreshCw className="h-5 w-5" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header Section */}
      <div className="relative overflow-hidden bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-700 text-white">
        {/* Animated background */}
        <div aria-hidden className="absolute inset-0">
          <div className="absolute top-0 right-1/4 h-96 w-96 rounded-full bg-white/10 blur-3xl"></div>
          <div className="absolute bottom-0 left-1/4 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl"></div>
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-3 sm:mb-4 shadow-lg">
                <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-300" />
                <span className="text-white/90 font-medium text-xs sm:text-sm">Live Metrics</span>
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold mb-2 sm:mb-3">
                Fairness Dashboard
              </h1>
              <p className="text-base sm:text-lg md:text-xl text-white/90 mb-2">
                Public transparency metrics for ENIGMA Phase 1 evaluations
              </p>
              {lastUpdated && (
                <div className="inline-flex items-center gap-2 text-xs sm:text-sm text-white/70">
                  <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span>Last updated: {lastUpdated.toLocaleString()}</span>
                </div>
              )}
            </div>

            <button
              onClick={fetchStats}
              disabled={loading}
              className="w-full md:w-auto flex items-center justify-center gap-2 min-h-[44px] px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl bg-white/10 backdrop-blur-sm border-2 border-white/30 text-white font-semibold hover:bg-white/20 transition-all shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 touch-manipulation"
            >
              <RefreshCw className={`h-4 w-4 sm:h-5 sm:w-5 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-sm sm:text-base">Refresh Data</span>
            </button>
          </div>
        </div>

        {/* Bottom wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg className="w-full h-12 text-slate-50" preserveAspectRatio="none" viewBox="0 0 1440 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 48h1440V0C1440 0 1080 48 720 48S0 0 0 0v48z" fill="currentColor"/>
          </svg>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">

      {stats && (
        <>
          {/* Overview Stats */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 -mt-16 relative z-10">
            <div className="group relative overflow-hidden rounded-2xl bg-white shadow-xl hover:shadow-2xl transition-all duration-300 border border-gray-100">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-primary-100 to-indigo-100 rounded-bl-full opacity-50"></div>
              <div className="relative px-8 py-10 text-center">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 mb-5 shadow-lg group-hover:scale-110 transition-transform">
                  <FileText className="h-8 w-8 text-white" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-2">Total Applications</p>
                <p className="text-5xl font-extrabold bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent">
                  {stats.total_applications}
                </p>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl bg-white shadow-xl hover:shadow-2xl transition-all duration-300 border border-gray-100">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-100 to-teal-100 rounded-bl-full opacity-50"></div>
              <div className="relative px-8 py-10 text-center">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-5 shadow-lg group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="h-8 w-8 text-white" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-2">Completed Evaluations</p>
                <p className="text-5xl font-extrabold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  {stats.completed_evaluations}
                </p>
              </div>
            </div>

            <div className="group relative overflow-hidden rounded-2xl bg-white shadow-xl hover:shadow-2xl transition-all duration-300 border border-gray-100 sm:col-span-2 lg:col-span-1">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-100 to-pink-100 rounded-bl-full opacity-50"></div>
              <div className="relative px-8 py-10 text-center">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 mb-5 shadow-lg group-hover:scale-110 transition-transform">
                  <BarChart3 className="h-8 w-8 text-white" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-2">Average Score</p>
                <p className="text-5xl font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  {stats.average_score !== null ? stats.average_score.toFixed(1) : 'N/A'}
                </p>
                {stats.average_score !== null && (
                  <p className="text-sm text-gray-500 mt-1">out of 100</p>
                )}
              </div>
            </div>
          </div>

          {/* Processing Pipeline */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-8 hover:shadow-2xl transition-shadow duration-300">
          <div className="bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-700 px-8 py-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Activity className="h-6 w-6 text-white" />
                </div>
                <div>
                <h2 className="text-2xl font-bold text-white">Processing Pipeline</h2>
                <p className="text-indigo-100 text-sm">Current status of applications</p>
                </div>
              </div>
            </div>
            <div className="p-8 space-y-5">
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

                const statusConfig: Record<string, { gradient: string; bg: string; icon: any }> = {
                  submitted: { gradient: 'from-primary-500 to-indigo-600', bg: 'bg-primary-50', icon: FileText },
                  identity_scrubbing: { gradient: 'from-purple-500 to-pink-600', bg: 'bg-purple-50', icon: Shield },
                  worker_evaluation: { gradient: 'from-yellow-500 to-orange-600', bg: 'bg-yellow-50', icon: Zap },
                  judge_review: { gradient: 'from-orange-500 to-red-600', bg: 'bg-orange-50', icon: Eye },
                  final_scoring: { gradient: 'from-indigo-500 to-purple-600', bg: 'bg-indigo-50', icon: Target },
                  completed: { gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50', icon: CheckCircle2 },
                  failed: { gradient: 'from-red-500 to-pink-600', bg: 'bg-red-50', icon: AlertCircle },
                };

                const config = statusConfig[status] || { gradient: 'from-gray-500 to-gray-600', bg: 'bg-gray-50', icon: Database };
                const Icon = config.icon;

                return (
                  <div key={status} className="group">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-lg ${config.bg} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                          <Icon className="h-5 w-5 text-gray-700" />
                        </div>
                        <p className="font-semibold text-gray-900">
                          {statusLabels[status] || status}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">{count}</p>
                        <p className="text-xs text-gray-500">{percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden shadow-inner">
                      <div
                        className={`h-3 rounded-full bg-gradient-to-r ${config.gradient} transition-all duration-500 shadow-lg`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Score Distribution */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-8 hover:shadow-2xl transition-shadow duration-300">
          <div className="bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-700 px-8 py-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <div>
                <h2 className="text-2xl font-bold text-white">Score Distribution</h2>
                <p className="text-indigo-100 text-sm">Distribution of final scores</p>
                </div>
              </div>
            </div>
            <div className="p-8 space-y-6">
              {Object.entries(stats.score_distribution).map(([range, count]) => {
                const total = stats.completed_evaluations;
                const percentage = total > 0 ? (count / total) * 100 : 0;

                const rangeConfig: Record<string, { gradient: string; bg: string; icon: any }> = {
                  '90-100': { gradient: 'from-green-500 to-emerald-600', bg: 'bg-green-50', icon: Star },
                  '80-89': { gradient: 'from-primary-500 to-indigo-600', bg: 'bg-primary-50', icon: Sparkles },
                  '70-79': { gradient: 'from-yellow-500 to-orange-600', bg: 'bg-yellow-50', icon: Award },
                  '60-69': { gradient: 'from-orange-500 to-red-600', bg: 'bg-orange-50', icon: Target },
                  'below-60': { gradient: 'from-red-500 to-pink-600', bg: 'bg-red-50', icon: TrendingUp },
                };

                const config = rangeConfig[range] || { gradient: 'from-gray-500 to-gray-600', bg: 'bg-gray-50', icon: BarChart3 };
                const Icon = config.icon;

                return (
                  <div key={range} className="group">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`h-12 w-12 rounded-xl ${config.bg} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform`}>
                          <Icon className="h-6 w-6 text-gray-700" />
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-lg">{range}</p>
                          <p className="text-xs text-gray-500">Score range</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-gray-900">{count}</p>
                        <p className="text-xs text-gray-500">{percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden shadow-inner">
                      <div
                        className={`h-4 rounded-full bg-gradient-to-r ${config.gradient} transition-all duration-500 shadow-lg`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}

              {stats.completed_evaluations === 0 && (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-gray-100 mb-4">
                    <BarChart3 className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 font-medium">No completed evaluations yet</p>
                </div>
              )}
            </div>
          </div>

          {/* Fairness Guarantees */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-8 hover:shadow-2xl transition-shadow duration-300">
          <div className="bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-700 px-8 py-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <div>
                <h2 className="text-2xl font-bold text-white">Fairness Guarantees</h2>
                <p className="text-indigo-100 text-sm">How ENIGMA ensures bias-free evaluation</p>
                </div>
              </div>
            </div>
            <div className="p-8 grid md:grid-cols-2 gap-6">
              <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-6 border-2 border-emerald-200 hover:border-emerald-300 transition-all hover:shadow-lg">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-200/30 rounded-bl-full"></div>
                <div className="relative flex items-start gap-4">
                  <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Eye className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-emerald-900 mb-2 text-lg">Blind Evaluation</h3>
                    <p className="text-sm text-emerald-800 leading-relaxed">
                      100% of applications undergo identity scrubbing before AI evaluation.
                      All names, demographics, and identifying information are removed.
                    </p>
                  </div>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-primary-50 to-indigo-50 p-6 border-2 border-primary-200 hover:border-primary-300 transition-all hover:shadow-lg">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary-200/30 rounded-bl-full"></div>
                <div className="relative flex items-start gap-4">
                  <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Users className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-primary-900 mb-2 text-lg">Worker-Judge Validation</h3>
                    <p className="text-sm text-primary-800 leading-relaxed">
                      Two-tier AI system with bias detection. Judge AI validates Worker AI
                      evaluations for quality and fairness before approval.
                    </p>
                  </div>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 p-6 border-2 border-purple-200 hover:border-purple-300 transition-all hover:shadow-lg">
                <div className="absolute top-0 right-0 w-24 h-24 bg-purple-200/30 rounded-bl-full"></div>
                <div className="relative flex items-start gap-4">
                  <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Lock className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-purple-900 mb-2 text-lg">Cryptographic Audit</h3>
                    <p className="text-sm text-purple-800 leading-relaxed">
                      Every decision is hashed with SHA-256. Public verification portal allows
                      anyone to detect tampering.
                    </p>
                  </div>
                </div>
              </div>

              <div className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-orange-50 to-yellow-50 p-6 border-2 border-orange-200 hover:border-orange-300 transition-all hover:shadow-lg">
                <div className="absolute top-0 right-0 w-24 h-24 bg-orange-200/30 rounded-bl-full"></div>
                <div className="relative flex items-start gap-4">
                  <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-gradient-to-br from-orange-500 to-yellow-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                    <Eye className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <h3 className="font-bold text-orange-900 mb-2 text-lg">Complete Transparency</h3>
                    <p className="text-sm text-orange-800 leading-relaxed">
                      All applicants receive detailed explanations, score breakdowns, strengths,
                      and areas for improvement.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* System Health */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-8 hover:shadow-2xl transition-shadow duration-300">
          <div className="bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-700 px-8 py-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <div>
                <h2 className="text-2xl font-bold text-white">System Health</h2>
                <p className="text-indigo-100 text-sm">Processing performance metrics</p>
                </div>
              </div>
            </div>
            <div className="p-8 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="group text-center bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-8 border-2 border-green-200 hover:border-green-300 transition-all hover:shadow-lg">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 mb-4 shadow-lg group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="h-8 w-8 text-white" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-2">Success Rate</p>
                <p className="text-4xl font-extrabold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
                  {stats.total_applications > 0
                    ? ((stats.completed_evaluations / stats.total_applications) * 100).toFixed(1)
                    : '0'}%
                </p>
                <p className="text-xs text-gray-500">
                  {stats.completed_evaluations} / {stats.total_applications} completed
                </p>
              </div>

              <div className="group text-center bg-gradient-to-br from-primary-50 to-indigo-50 rounded-2xl p-8 border-2 border-primary-200 hover:border-primary-300 transition-all hover:shadow-lg">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 mb-4 shadow-lg group-hover:scale-110 transition-transform">
                  <RefreshCw className="h-8 w-8 text-white" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-2">In Progress</p>
                <p className="text-4xl font-extrabold bg-gradient-to-r from-primary-600 to-indigo-600 bg-clip-text text-transparent mb-2">
                  {stats.total_applications - stats.completed_evaluations}
                </p>
                <p className="text-xs text-gray-500">
                  Applications being processed
                </p>
              </div>

              <div className="group text-center bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 border-2 border-purple-200 hover:border-purple-300 transition-all hover:shadow-lg sm:col-span-2 lg:col-span-1">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-600 mb-4 shadow-lg group-hover:scale-110 transition-transform">
                  <Target className="h-8 w-8 text-white" />
                </div>
                <p className="text-sm font-medium text-gray-600 mb-2">Merit-Based</p>
                <p className="text-4xl font-extrabold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">100%</p>
                <p className="text-xs text-gray-500">
                  No demographic factors considered
                </p>
              </div>
            </div>
          </div>

          {/* About Phase 1 */}
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden hover:shadow-2xl transition-shadow duration-300">
          <div className="bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-700 px-8 py-6">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Database className="h-6 w-6 text-white" />
                </div>
                <div>
                <h2 className="text-2xl font-bold text-white">About Phase 1 Evaluation</h2>
                <p className="text-indigo-100 text-sm">The blind AI screening process</p>
                </div>
              </div>
            </div>
            <div className="p-8">
              <p className="text-gray-700 leading-relaxed mb-6">
                <span className="font-bold text-gray-900">Phase 1</span> is ENIGMA's blind AI screening stage. Every application
                goes through the following process:
              </p>

              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-primary-50 to-indigo-50 rounded-xl border border-primary-200">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                    1
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">Identity Scrubbing</h4>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      All personally identifiable information (name, contact info, demographics) is removed from the application.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                    2
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">Worker AI Evaluation</h4>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      An AI evaluates academic performance, test scores, achievements, and essay quality based purely on merit.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                    3
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">Judge AI Validation</h4>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      A second AI reviews the Worker's evaluation for bias, quality, and rubric adherence.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl border border-orange-200">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-orange-500 to-yellow-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                    4
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">Retry Loop</h4>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      If the Judge detects issues, the Worker re-evaluates with feedback (up to 3 attempts).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border border-blue-200">
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                    5
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 mb-1">Final Scoring</h4>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      Approved scores are aggregated and hashed for cryptographic verification.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-6 bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl border-2 border-gray-200">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-gray-600 to-slate-700 flex items-center justify-center">
                      <CheckCircle2 className="h-5 w-5 text-white" />
                    </div>
                  </div>
                  <p className="text-gray-800 leading-relaxed flex-1">
                    This process ensures every applicant is judged <span className="font-bold text-gray-900">solely on their academic merit</span>,
                    with complete transparency and accountability.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
      </div>
    </div>
  );
}
