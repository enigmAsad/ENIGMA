'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { adminApiClient, type AdmissionCycle, type CycleStatus } from '@/lib/adminApi';
import { apiClient } from '@/lib/api';
import PhaseProgress from '@/components/PhaseProgress';
import {
  LayoutDashboard, Users, Award, TrendingUp, Calendar,
  Settings, Eye, FileText, CheckCircle2, Clock,
  AlertCircle, Loader2, Shield, BarChart3, Target,
  ChevronRight, Sparkles, Activity
} from 'lucide-react';

export default function AdminDashboard() {
  const router = useRouter();
  const { isAuthenticated, isLoading, admin, logout } = useAdminAuth();
  const [activeCycle, setActiveCycle] = useState<AdmissionCycle | null>(null);
  const [cycleStatus, setCycleStatus] = useState<CycleStatus | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboardData();
    }
  }, [isAuthenticated]);

  const loadDashboardData = async () => {
    try {
      const [cycle, dashStats] = await Promise.all([
        adminApiClient.getActiveCycle(),
        apiClient.getDashboardStats(),
      ]);

      setActiveCycle(cycle);
      setStats(dashStats);

      if (cycle) {
        try {
          const status = await adminApiClient.getCycleStatus(cycle.cycle_id);
          setCycleStatus(status);
        } catch (error) {
          console.error('Failed to load cycle status:', error);
        }
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handlePhaseTransition = async (action: string) => {
    if (!activeCycle) return;

    setProcessingAction(action);
    try {
      let result;
      switch (action) {
        case 'freeze':
          result = await adminApiClient.freezeCycle(activeCycle.cycle_id);
          break;
        case 'preprocess':
          result = await adminApiClient.startPreprocessing(activeCycle.cycle_id);
          break;
        case 'export':
          result = await adminApiClient.exportBatchData(activeCycle.cycle_id);
          alert(`Exported ${result.record_count} applications. Batch ID: ${result.batch_id}`);
          break;
        case 'processing':
          result = await adminApiClient.startLLMProcessing(activeCycle.cycle_id);
          break;
        case 'select':
          result = await adminApiClient.performSelection(activeCycle.cycle_id);
          alert(`Selected ${result.selected_count} applicants with cutoff score ${result.cutoff_score.toFixed(2)}`);
          break;
        case 'final_select':
          result = await adminApiClient.performFinalSelection(activeCycle.cycle_id);
          alert(`Final selection completed: ${result.selected_count} applicants selected`);
          break;
        case 'publish':
          result = await adminApiClient.publishResults(activeCycle.cycle_id);
          break;
        case 'complete':
          result = await adminApiClient.completeCycle(activeCycle.cycle_id);
          break;
        default:
          throw new Error('Unknown action');
      }

      await loadDashboardData();
    } catch (error: any) {
      alert(error.message || `Failed to ${action} cycle`);
      console.error(`Phase transition error:`, error);
    } finally {
      setProcessingAction(null);
    }
  };

  const getAvailableActions = () => {
    if (!activeCycle) return [];

    const actions = [];
    const phase = activeCycle.phase;

    switch (phase) {
      case 'submission':
        actions.push({ key: 'freeze', label: 'Freeze Cycle', variant: 'teal', icon: Shield });
        break;
      case 'frozen':
        actions.push({ key: 'preprocess', label: 'Start Preprocessing', variant: 'teal', icon: Activity });
        break;
      case 'preprocessing':
        actions.push({ key: 'export', label: 'Export for LLM', variant: 'teal', icon: FileText });
        break;
      case 'batch_prep':
        actions.push({ key: 'processing', label: 'Run LLM Evaluation', variant: 'teal', icon: TrendingUp });
        break;
      case 'processing':
        actions.push({ key: 'processing', label: 'Re-run LLM Evaluation', variant: 'gray', icon: TrendingUp });
        break;
      case 'scored':
        actions.push({ key: 'select', label: 'Perform Shortlisting', variant: 'teal', icon: Target });
        break;
      case 'selection':
        actions.push({ key: 'final_select', label: 'Perform Final Selection', variant: 'teal', icon: CheckCircle2 });
        break;
      case 'published':
        actions.push({ key: 'complete', label: 'Complete Cycle', variant: 'gray', icon: CheckCircle2 });
        break;
    }

    return actions;
  };

  const getPhaseColor = (phase: string) => {
    const phaseMap: Record<string, string> = {
      submission: 'bg-blue-100 text-blue-700',
      frozen: 'bg-purple-100 text-purple-700',
      preprocessing: 'bg-yellow-100 text-yellow-700',
      batch_prep: 'bg-orange-100 text-orange-700',
      processing: 'bg-pink-100 text-pink-700',
      scored: 'bg-indigo-100 text-indigo-700',
      selection: 'bg-teal-100 text-teal-700',
      published: 'bg-green-100 text-green-700',
      completed: 'bg-gray-100 text-gray-700',
    };
    return phaseMap[phase] || 'bg-gray-100 text-gray-700';
  };

  if (isLoading || loadingData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-teal-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50 to-cyan-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-600 via-teal-700 to-cyan-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="h-20 w-20 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center ring-4 ring-white/10">
                  <LayoutDashboard className="h-10 w-10 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                  <Sparkles className="h-6 w-6 text-yellow-300 flex-shrink-0" />
                </div>
                <p className="text-teal-100">Welcome back, {admin?.username || 'Administrator'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">Total Applications</p>
                    <p className="text-4xl font-bold text-gray-900">{stats.total_applications}</p>
                  </div>
                  <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-teal-100 flex items-center justify-center">
                    <FileText className="h-7 w-7 text-teal-600" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">Completed Evaluations</p>
                    <p className="text-4xl font-bold text-gray-900">{stats.completed_evaluations}</p>
                  </div>
                  <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="h-7 w-7 text-green-600" />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-600 mb-1">Average Score</p>
                    <p className="text-4xl font-bold text-gray-900">
                      {stats.average_score ? stats.average_score.toFixed(1) : 'N/A'}
                    </p>
                  </div>
                  <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-purple-100 flex items-center justify-center">
                    <BarChart3 className="h-7 w-7 text-purple-600" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Active Cycle Section */}
        {activeCycle ? (
          <div className="space-y-6 mb-8">
            {/* Cycle Info Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="bg-gradient-to-r from-teal-500 to-cyan-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Current Admission Cycle
                  </h2>
                  <button
                    onClick={() => router.push('/admin/cycles')}
                    className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm border border-white/30 rounded-lg transition-all text-white text-sm font-medium"
                  >
                    Manage Cycles
                  </button>
                </div>
              </div>

              <div className="p-6">
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <h3 className="text-2xl font-bold text-gray-900">{activeCycle.cycle_name}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPhaseColor(activeCycle.phase)}`}>
                    {activeCycle.phase.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    activeCycle.is_open
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {activeCycle.is_open ? 'OPEN' : 'CLOSED'}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                    <p className="text-xs text-blue-600 font-medium mb-1">Max Seats</p>
                    <p className="text-2xl font-bold text-blue-900">{activeCycle.max_seats}</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                    <p className="text-xs text-green-600 font-medium mb-1">Selected</p>
                    <p className="text-2xl font-bold text-green-900">{activeCycle.selected_count || 0}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                    <p className="text-xs text-purple-600 font-medium mb-1">Start Date</p>
                    <p className="text-sm font-bold text-purple-900">
                      {new Date(activeCycle.start_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
                    <p className="text-xs text-orange-600 font-medium mb-1">End Date</p>
                    <p className="text-sm font-bold text-orange-900">
                      {new Date(activeCycle.end_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Detailed Application Stats */}
                {cycleStatus && (
                  <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-200">
                    <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Application Status Breakdown
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="text-center">
                        <p className="text-3xl font-bold text-teal-600">{cycleStatus.stats.total_applications}</p>
                        <p className="text-xs text-gray-600 mt-1">Total</p>
                      </div>
                      <div className="text-center">
                        <p className="text-3xl font-bold text-yellow-600">{cycleStatus.stats.submitted}</p>
                        <p className="text-xs text-gray-600 mt-1">Submitted</p>
                      </div>
                      <div className="text-center">
                        <p className="text-3xl font-bold text-purple-600">{cycleStatus.stats.finalized}</p>
                        <p className="text-xs text-gray-600 mt-1">Finalized</p>
                      </div>
                      <div className="text-center">
                        <p className="text-3xl font-bold text-green-600">{cycleStatus.stats.scored}</p>
                        <p className="text-xs text-gray-600 mt-1">Scored</p>
                      </div>
                      <div className="text-center">
                        <p className="text-3xl font-bold text-indigo-600">{cycleStatus.stats.selected}</p>
                        <p className="text-xs text-gray-600 mt-1">Selected</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Phase Progress */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Activity className="h-5 w-5 text-teal-600" />
                Cycle Progress
              </h3>
              <PhaseProgress currentPhase={activeCycle.phase} />
            </div>

            {/* Phase Actions */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Target className="h-5 w-5 text-teal-600" />
                Available Actions
              </h3>
              <div className="flex flex-wrap gap-3">
                {getAvailableActions().map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.key}
                      onClick={() => handlePhaseTransition(action.key)}
                      disabled={processingAction !== null}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                        action.variant === 'teal'
                          ? 'bg-teal-600 text-white hover:bg-teal-700'
                          : 'bg-gray-600 text-white hover:bg-gray-700'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {processingAction === action.key ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        action.label
                      )}
                    </button>
                  );
                })}
                {getAvailableActions().length === 0 && (
                  <p className="text-gray-500 italic flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    No actions available for current phase
                  </p>
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
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Active Admission Cycle</h3>
                <p className="text-gray-600 mb-4">
                  Create a new admission cycle to start accepting and processing applications.
                </p>
                <button
                  onClick={() => router.push('/admin/cycles')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all font-medium shadow-md hover:shadow-lg"
                >
                  <Calendar className="h-4 w-4" />
                  Create Admission Cycle
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions Grid */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Settings className="h-5 w-5 text-teal-600" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              onClick={() => router.push('/admin/cycles')}
              className="group bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl p-6 border border-teal-200 hover:shadow-lg transition-all text-left"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center group-hover:bg-teal-200 transition-colors">
                  <Calendar className="h-5 w-5 text-teal-600" />
                </div>
                <ChevronRight className="h-5 w-5 text-teal-400 group-hover:text-teal-600 transition-colors" />
              </div>
              <h3 className="font-bold text-gray-900 mb-1">Manage Cycles</h3>
              <p className="text-sm text-gray-600">Create, edit, or close cycles</p>
            </button>

            <button
              onClick={() => router.push('/admin/interviews')}
              className="group bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200 hover:shadow-lg transition-all text-left"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <ChevronRight className="h-5 w-5 text-purple-400 group-hover:text-purple-600 transition-colors" />
              </div>
              <h3 className="font-bold text-gray-900 mb-1">Interviews</h3>
              <p className="text-sm text-gray-600">Schedule & manage sessions</p>
            </button>

            <button
              onClick={() => router.push('/admin/bias')}
              className="group bg-gradient-to-br from-orange-50 to-red-50 rounded-xl p-6 border border-orange-200 hover:shadow-lg transition-all text-left"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                  <Shield className="h-5 w-5 text-orange-600" />
                </div>
                <ChevronRight className="h-5 w-5 text-orange-400 group-hover:text-orange-600 transition-colors" />
              </div>
              <h3 className="font-bold text-gray-900 mb-1">Bias Monitor</h3>
              <p className="text-sm text-gray-600">View bias alerts & flags</p>
            </button>

            <button
              onClick={() => router.push('/dashboard')}
              className="group bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 hover:shadow-lg transition-all text-left"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                  <Eye className="h-5 w-5 text-blue-600" />
                </div>
                <ChevronRight className="h-5 w-5 text-blue-400 group-hover:text-blue-600 transition-colors" />
              </div>
              <h3 className="font-bold text-gray-900 mb-1">Public View</h3>
              <p className="text-sm text-gray-600">See applicant perspective</p>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
