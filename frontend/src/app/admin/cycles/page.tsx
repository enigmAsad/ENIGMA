'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { adminApiClient, type AdmissionCycle, type CreateCycleRequest, type CycleStatus } from '@/lib/adminApi';
import PhaseProgress from '@/components/PhaseProgress';
import BatchManagement from '@/components/BatchManagement';

// Utility function to format dates in Pakistan Standard Time
const formatInPKT = (dateString: string) => {
  const date = new Date(dateString);
  return {
    date: date.toLocaleDateString('en-PK', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }),
    time: date.toLocaleTimeString('en-PK', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    })
  };
};

export default function AdminCyclesPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, admin, logout } = useAdminAuth();
  const [cycles, setCycles] = useState<AdmissionCycle[]>([]);
  const [cycleStatuses, setCycleStatuses] = useState<Record<string, CycleStatus>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState<CreateCycleRequest>({
    cycle_name: '',
    max_seats: 1,
    result_date: '',
    start_date: '',
    end_date: '',
  });
  const [formError, setFormError] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [expandedCycle, setExpandedCycle] = useState<string | null>(null);
  const [deletingCycleId, setDeletingCycleId] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      loadCycles();
    }
  }, [isAuthenticated]);

  const loadCycles = async () => {
    try {
      const data = await adminApiClient.getAllCycles();
      setCycles(data);

      // Load status for each cycle
      const statusPromises = data.map(async (cycle) => {
        try {
          const status = await adminApiClient.getCycleStatus(cycle.cycle_id);
          return { cycleId: cycle.cycle_id, status };
        } catch (error) {
          console.error(`Failed to load status for cycle ${cycle.cycle_id}:`, error);
          return null;
        }
      });

      const statuses = await Promise.all(statusPromises);
      const statusMap: Record<string, CycleStatus> = {};
      statuses.forEach((item) => {
        if (item) {
          statusMap[item.cycleId] = item.status;
        }
      });
      setCycleStatuses(statusMap);
    } catch (error) {
      console.error('Failed to load cycles:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const handlePhaseTransition = async (cycleId: string, action: string) => {
    setProcessing(cycleId);
    try {
      let result;
      switch (action) {
        case 'freeze':
          result = await adminApiClient.freezeCycle(cycleId);
          break;
        case 'preprocess':
          result = await adminApiClient.startPreprocessing(cycleId);
          break;
        case 'export':
          result = await adminApiClient.exportBatchData(cycleId);
          alert(`Exported ${result.record_count} applications. Batch ID: ${result.batch_id}`);
          break;
        case 'processing':
          result = await adminApiClient.startLLMProcessing(cycleId);
          break;
        case 'select':
          result = await adminApiClient.performSelection(cycleId);
          alert(`Selected ${result.selected_count} applicants with cutoff score ${result.cutoff_score.toFixed(2)}`);
          break;
        case 'publish':
          result = await adminApiClient.publishResults(cycleId);
          break;
        case 'complete':
          result = await adminApiClient.completeCycle(cycleId);
          break;
        default:
          throw new Error('Unknown action');
      }

      // Refresh data
      await loadCycles();
    } catch (error: any) {
      alert(error.message || `Failed to ${action} cycle`);
      console.error(`Phase transition error:`, error);
    } finally {
      setProcessing(null);
    }
  };

  const getAvailableActions = (cycle: AdmissionCycle) => {
    const actions = [];
    const phase = cycle.phase;

    // Backend returns lowercase phase values (e.g., 'submission', 'batch_prep')
    switch (phase) {
      case 'submission':
        actions.push({ key: 'freeze', label: 'Freeze Cycle', variant: 'primary' });
        break;
      case 'frozen':
        actions.push({ key: 'preprocess', label: 'Start Preprocessing', variant: 'primary' });
        break;
      case 'preprocessing':
        actions.push({ key: 'export', label: 'Export for LLM', variant: 'primary' });
        break;
      case 'batch_prep':
        actions.push({ key: 'processing', label: 'Run LLM Evaluation', variant: 'primary' });
        break;
      case 'processing':
        actions.push({ key: 'processing', label: 'Re-run LLM Evaluation', variant: 'secondary' });
        break;
      case 'scored':
        actions.push({ key: 'select', label: 'Perform Selection', variant: 'primary' });
        break;
      case 'selection':
        actions.push({ key: 'publish', label: 'Publish Results', variant: 'primary' });
        break;
      case 'published':
        actions.push({ key: 'complete', label: 'Complete Cycle', variant: 'secondary' });
        break;
    }

    return actions;
  };

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setProcessing('create');

    try {
      await adminApiClient.createCycle(formData);
      await loadCycles();
      setShowCreateForm(false);
      setFormData({
        cycle_name: '',
        max_seats: 1,
        result_date: '',
        start_date: '',
        end_date: '',
      });
    } catch (error: any) {
      setFormError(error.message || 'Failed to create cycle');
    } finally {
      setProcessing(null);
    }
  };

  const handleOpenCycle = async (cycleId: string) => {
    setProcessing(cycleId);
    try {
      await adminApiClient.openCycle(cycleId);
      await loadCycles();
    } catch (error: any) {
      alert(error.message || 'Failed to open cycle');
    } finally {
      setProcessing(null);
    }
  };

  const handleCloseCycle = async (cycleId: string) => {
    setProcessing(cycleId);
    try {
      await adminApiClient.closeCycle(cycleId);
      await loadCycles();
    } catch (error: any) {
      alert(error.message || 'Failed to close cycle');
    } finally {
      setProcessing(null);
    }
  };

  const handleDeleteCycle = async (cycle: AdmissionCycle) => {
    if (!confirm(`Are you sure you want to delete the cycle "${cycle.cycle_name}"? This cannot be undone.`)) {
      return;
    }

    setDeletingCycleId(cycle.cycle_id);
    try {
      const response = await adminApiClient.deleteCycle(cycle.cycle_id);
      alert(response.message);
      await loadCycles();
    } catch (error: any) {
      alert(error.message || 'Failed to delete cycle');
    } finally {
      setDeletingCycleId(null);
    }
  };

  if (isLoading || loadingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading cycles...</p>
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
              <h1 className="text-2xl font-bold text-gray-900">Admission Cycles</h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage admission cycles and control application periods
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => router.push('/admin/dashboard')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Back to Dashboard
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
        {/* Create Cycle Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            {showCreateForm ? 'Cancel' : '+ Create New Cycle'}
          </button>
        </div>

        {/* Create Cycle Form */}
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Create Admission Cycle</h2>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{formError}</p>
              </div>
            )}

            <form onSubmit={handleCreateCycle} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cycle Name
                </label>
                <input
                  type="text"
                  value={formData.cycle_name}
                  onChange={(e) => setFormData({ ...formData, cycle_name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Fall 2025 Admissions"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Maximum Seats
                </label>
                <input
                  type="number"
                  value={formData.max_seats}
                  onChange={(e) => setFormData({ ...formData, max_seats: parseInt(e.target.value) || 1 })}
                  required
                  min="1"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 100"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    End Date
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Result Date
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.result_date}
                    onChange={(e) => setFormData({ ...formData, result_date: e.target.value })}
                    required
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={processing === 'create'}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                >
                  {processing === 'create' ? 'Creating...' : 'Create Cycle'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setFormError('');
                  }}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Cycles List */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">All Admission Cycles</h2>

          {cycles.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600">No admission cycles created yet.</p>
              <p className="text-sm text-gray-500 mt-2">Create your first cycle to get started.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {cycles.map((cycle) => {
                const status = cycleStatuses[cycle.cycle_id];
                const availableActions = getAvailableActions(cycle);
                const isExpanded = expandedCycle === cycle.cycle_id;

                return (
                  <div key={cycle.cycle_id} className="bg-white rounded-lg shadow-lg">
                    <div className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-xl font-bold text-gray-900">{cycle.cycle_name}</h3>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${cycle.phase === 'COMPLETED'
                              ? 'bg-green-100 text-green-700'
                              : cycle.is_open
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-red-100 text-red-700'
                              }`}>
                              {cycle.phase.replace('_', ' ').toLowerCase()}
                            </span>
                            {cycle.is_open ? (
                              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                                Open
                              </span>
                            ) : (
                              <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                                Closed
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-4">
                            <div>
                              <p className="text-xs text-gray-500 uppercase">Applications</p>
                              <p className="text-lg font-semibold text-gray-900">
                                {cycle.current_seats}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                submitted
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-gray-500 uppercase">Selection Target</p>
                              <p className="text-lg font-semibold text-gray-900">
                                {cycle.max_seats}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                top-K to select
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-gray-500 uppercase">Selected</p>
                              <p className="text-lg font-semibold text-gray-900">
                                {cycle.selected_count || 0}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                in Phase 7
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-gray-500 uppercase">Start Date</p>
                              <p className="text-sm font-medium text-gray-900">
                                {formatInPKT(cycle.start_date).date}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatInPKT(cycle.start_date).time} (PKT)
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-gray-500 uppercase">End Date</p>
                              <p className="text-sm font-medium text-gray-900">
                                {formatInPKT(cycle.end_date).date}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatInPKT(cycle.end_date).time} (PKT)
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-gray-500 uppercase">Result Date</p>
                              <p className="text-sm font-medium text-gray-900">
                                {formatInPKT(cycle.result_date).date}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatInPKT(cycle.result_date).time} (PKT)
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-gray-500 uppercase">Cycle ID</p>
                              <p className="text-sm font-mono text-gray-900">{cycle.cycle_id}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 ml-6">
                          <button
                            onClick={() => setExpandedCycle(isExpanded ? null : cycle.cycle_id)}
                            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                          >
                            {isExpanded ? 'Collapse' : 'Expand'}
                          </button>

                          {cycle.is_open ? (
                            <button
                              onClick={() => handleCloseCycle(cycle.cycle_id)}
                              disabled={processing === cycle.cycle_id}
                              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap"
                            >
                              {processing === cycle.cycle_id ? 'Closing...' : 'Close Cycle'}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleOpenCycle(cycle.cycle_id)}
                              disabled={processing === cycle.cycle_id}
                              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap"
                            >
                              {processing === cycle.cycle_id ? 'Opening...' : 'Open Cycle'}
                            </button>
                          )}
                          {!cycle.is_open && (
                            <button
                              onClick={() => handleDeleteCycle(cycle)}
                              disabled={deletingCycleId === cycle.cycle_id || processing === cycle.cycle_id}
                              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap"
                            >
                              {deletingCycleId === cycle.cycle_id ? 'Deleting...' : 'Delete Cycle'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t border-gray-200">
                        <div className="p-6">
                          {/* Phase Progress */}
                          <div className="mb-6">
                            <PhaseProgress currentPhase={cycle.phase} />
                          </div>

                          {/* Application Status */}
                          {status && (
                            <div className="mb-6">
                              <h4 className="text-lg font-semibold text-gray-900 mb-4">Application Status</h4>
                              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div className="text-center">
                                  <p className="text-2xl font-bold text-blue-600">{status.stats.total_applications}</p>
                                  <p className="text-sm text-gray-600">Total Applications</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-2xl font-bold text-yellow-600">{status.stats.submitted}</p>
                                  <p className="text-sm text-gray-600">Submitted</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-2xl font-bold text-purple-600">{status.stats.finalized}</p>
                                  <p className="text-sm text-gray-600">Finalized</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-2xl font-bold text-green-600">{status.stats.scored}</p>
                                  <p className="text-sm text-gray-600">Scored</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-2xl font-bold text-indigo-600">{status.stats.selected}</p>
                                  <p className="text-sm text-gray-600">Selected</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Phase Actions */}
                          {availableActions.length > 0 && (
                            <div className="mb-6">
                              <h4 className="text-lg font-semibold text-gray-900 mb-4">Phase Actions</h4>
                              <div className="flex flex-wrap gap-3">
                                {availableActions.map((action) => (
                                  <button
                                    key={action.key}
                                    onClick={() => handlePhaseTransition(cycle.cycle_id, action.key)}
                                    disabled={processing !== null}
                                    className={`px-4 py-2 rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed ${action.variant === 'primary'
                                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                                      : 'bg-gray-600 text-white hover:bg-gray-700'
                                      }`}
                                  >
                                    {processing === cycle.cycle_id ? 'Processing...' : action.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Batch Management - Show for PROCESSING and SCORED phases */}
                          {(cycle.phase === 'PROCESSING' || cycle.phase === 'SCORED') && (
                            <div className="mb-6">
                              <BatchManagement
                                cycleId={cycle.cycle_id}
                                onImportSuccess={() => loadCycles()}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
