'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { adminApiClient, type AdmissionCycle, type CycleStatus } from '@/lib/adminApi';
import { apiClient } from '@/lib/api';
import PhaseProgress from '@/components/PhaseProgress';

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

      // Load detailed cycle status if cycle exists
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
        case 'publish':
          result = await adminApiClient.publishResults(activeCycle.cycle_id);
          break;
        case 'complete':
          result = await adminApiClient.completeCycle(activeCycle.cycle_id);
          break;
        default:
          throw new Error('Unknown action');
      }

      // Refresh data
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
      case 'SUBMISSION':
        actions.push({ key: 'freeze', label: 'Freeze Cycle', variant: 'primary' });
        break;
      case 'FROZEN':
        actions.push({ key: 'preprocess', label: 'Start Preprocessing', variant: 'primary' });
        break;
      case 'PREPROCESSING':
        actions.push({ key: 'export', label: 'Export for LLM', variant: 'primary' });
        break;
      case 'BATCH_PREP':
        actions.push({ key: 'processing', label: 'Start LLM Processing', variant: 'primary' });
        break;
      case 'PROCESSING':
        // No direct action - LLM processing happens externally
        break;
      case 'SCORED':
        actions.push({ key: 'select', label: 'Perform Selection', variant: 'primary' });
        break;
      case 'SELECTION':
        actions.push({ key: 'publish', label: 'Publish Results', variant: 'primary' });
        break;
      case 'PUBLISHED':
        actions.push({ key: 'complete', label: 'Complete Cycle', variant: 'secondary' });
        break;
    }

    return actions;
  };

  if (isLoading || loadingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-sm text-gray-600 mt-1">
                Welcome back, {admin?.username}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/admin/cycles')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Manage Cycles
              </button>
              <button
                onClick={logout}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Active Cycle Status */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Current Admission Cycle</h2>
          {activeCycle ? (
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{activeCycle.cycle_name}</h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Phase: <span className="font-semibold capitalize">{activeCycle.phase.toLowerCase()}</span>
                    </p>
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Status</p>
                        <p className="text-lg font-semibold">
                          {activeCycle.is_open ? (
                            <span className="text-green-600">Open</span>
                          ) : (
                            <span className="text-red-600">Closed</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Seats</p>
                        <p className="text-lg font-semibold">
                          {activeCycle.current_seats} / {activeCycle.max_seats}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Selected</p>
                        <p className="text-lg font-semibold">
                          {activeCycle.selected_count || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Start Date</p>
                        <p className="text-lg font-semibold">
                          {new Date(activeCycle.start_date).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">End Date</p>
                        <p className="text-lg font-semibold">
                          {new Date(activeCycle.end_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => router.push('/admin/cycles')}
                      className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Manage
                    </button>
                  </div>
                </div>
              </div>

              {/* Phase Progress */}
              <PhaseProgress currentPhase={activeCycle.phase} />

              {/* Phase Actions */}
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Phase Actions</h3>
                <div className="flex flex-wrap gap-3">
                  {getAvailableActions().map((action) => (
                    <button
                      key={action.key}
                      onClick={() => handlePhaseTransition(action.key)}
                      disabled={processingAction !== null}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed ${
                        action.variant === 'primary'
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-600 text-white hover:bg-gray-700'
                      }`}
                    >
                      {processingAction === action.key ? 'Processing...' : action.label}
                    </button>
                  ))}
                  {getAvailableActions().length === 0 && (
                    <p className="text-gray-500 italic">No actions available for current phase</p>
                  )}
                </div>
              </div>

              {/* Detailed Status */}
              {cycleStatus && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Application Status</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{cycleStatus.stats.total_applications}</p>
                      <p className="text-sm text-gray-600">Total Applications</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-yellow-600">{cycleStatus.stats.submitted}</p>
                      <p className="text-sm text-gray-600">Submitted</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">{cycleStatus.stats.finalized}</p>
                      <p className="text-sm text-gray-600">Finalized</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{cycleStatus.stats.scored}</p>
                      <p className="text-sm text-gray-600">Scored</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-indigo-600">{cycleStatus.stats.selected}</p>
                      <p className="text-sm text-gray-600">Selected</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <p className="text-yellow-800">
                No active admission cycle. Create one to start accepting applications.
              </p>
              <button
                onClick={() => router.push('/admin/cycles')}
                className="mt-3 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
              >
                Create Admission Cycle
              </button>
            </div>
          )}
        </div>

        {/* Statistics */}
        {stats && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Overview</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">Total Applications</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                      {stats.total_applications}
                    </p>
                  </div>
                  <div className="text-blue-600">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">Completed Evaluations</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                      {stats.completed_evaluations}
                    </p>
                  </div>
                  <div className="text-green-600">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600">Average Score</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                      {stats.average_score ? stats.average_score.toFixed(1) : 'N/A'}
                    </p>
                  </div>
                  <div className="text-purple-600">
                    <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button
              onClick={() => router.push('/admin/cycles')}
              className="bg-white rounded-lg shadow p-6 text-left hover:shadow-lg transition-shadow"
            >
              <h3 className="font-semibold text-gray-900">Manage Cycles</h3>
              <p className="text-sm text-gray-600 mt-1">
                Create, edit, or close admission cycles
              </p>
            </button>

            <button
              onClick={() => router.push('/dashboard')}
              className="bg-white rounded-lg shadow p-6 text-left hover:shadow-lg transition-shadow"
            >
              <h3 className="font-semibold text-gray-900">View Public Dashboard</h3>
              <p className="text-sm text-gray-600 mt-1">
                See what applicants see
              </p>
            </button>

            <button
              onClick={() => router.push('/')}
              className="bg-white rounded-lg shadow p-6 text-left hover:shadow-lg transition-shadow"
            >
              <h3 className="font-semibold text-gray-900">View Homepage</h3>
              <p className="text-sm text-gray-600 mt-1">
                Check the public-facing site
              </p>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
