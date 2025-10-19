'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { adminApiClient, type AdmissionCycle, type CreateCycleRequest, type CycleStatus } from '@/lib/adminApi';
import PhaseProgress from '@/components/PhaseProgress';
import BatchManagement from '@/components/BatchManagement';
import {
  Calendar,
  Plus,
  Sparkles,
  Users,
  TrendingUp,
  Settings,
  ChevronDown,
  ChevronUp,
  Trash2,
  Lock,
  Unlock,
  Loader2,
  Home,
  LogOut,
  Clock,
  Award,
  Target,
  CheckCircle2
} from 'lucide-react';

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

// Utility function to convert datetime-local input to UTC ISO string
// Note: The browser automatically interprets datetime-local as LOCAL TIME
// Since the user is in PKT (UTC+5), the browser handles the conversion automatically
const convertLocalToUTC = (datetimeLocal: string): string => {
  if (!datetimeLocal) return '';

  // datetime-local format: "2025-10-17T14:30" (no timezone info)
  // new Date() treats this as LOCAL time (PKT in your case)
  // toISOString() automatically converts to UTC
  // Example: 14:00 PKT → 09:00 UTC ✅
  return new Date(datetimeLocal).toISOString();
};

// Utility function to get current time in PKT formatted for datetime-local input
const getCurrentPKTDatetimeLocal = (): string => {
  const now = new Date();

  // Get current time in PKT by adding 5 hours to UTC
  const pktTime = new Date(now.getTime() + (5 * 60 * 60 * 1000));

  // Format as datetime-local value: "YYYY-MM-DDTHH:mm"
  const year = pktTime.getUTCFullYear();
  const month = String(pktTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(pktTime.getUTCDate()).padStart(2, '0');
  const hours = String(pktTime.getUTCHours()).padStart(2, '0');
  const minutes = String(pktTime.getUTCMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
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
      // Fetch cycles WITH stats in a single request (optimized - no N+1 queries!)
      const data = await adminApiClient.getAllCycles(true);
      setCycles(data);

      // Extract stats from the combined response
      const statusMap: Record<string, CycleStatus> = {};
      data.forEach((cycle: any) => {
        if (cycle.stats) {
          // When include_stats=true, the response includes stats directly
          statusMap[cycle.cycle_id] = {
            cycle_id: cycle.cycle_id,
            cycle_name: cycle.cycle_name,
            phase: cycle.phase,
            is_open: cycle.is_open,
            max_seats: cycle.max_seats,
            current_seats: cycle.current_seats,
            selected_count: cycle.selected_count,
            stats: cycle.stats,
            dates: cycle.dates
          };
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
          alert(`Shortlisted ${result.selected_count} applicants with cutoff score ${result.cutoff_score.toFixed(2)}`);
          break;
        case 'final-select':
          // Type assertion because the response is different
          const finalResult = await adminApiClient.performFinalSelection(cycleId);
          alert(`Final Selection Complete: ${finalResult.selected_count} applicants selected.`);
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
        actions.push({
          key: 'select',
          label: 'Perform Shortlisting',
          variant: 'primary',
          description: `This will select the top ${cycle.max_seats * 2} applicants for interviews.`
        });
        break;
      case 'selection':
        actions.push({ key: 'final-select', label: 'Perform Final Selection', variant: 'primary' });
        actions.push({ key: 'publish', label: 'Publish Results', variant: 'secondary' });
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
      // Convert local datetime-local values to UTC ISO strings
      // Browser automatically treats input as local time (PKT) and converts to UTC
      const cycleData: CreateCycleRequest = {
        cycle_name: formData.cycle_name,
        max_seats: formData.max_seats,
        start_date: convertLocalToUTC(formData.start_date),
        end_date: convertLocalToUTC(formData.end_date),
        result_date: convertLocalToUTC(formData.result_date),
      };

      await adminApiClient.createCycle(cycleData);
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
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <Loader2 className="h-16 w-16 text-teal-600 animate-spin mx-auto" />
            <Calendar className="h-6 w-6 text-teal-700 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="mt-6 text-lg font-medium text-teal-900">Loading admission cycles...</p>
          <p className="text-sm text-teal-600 mt-2">Preparing your management dashboard</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100">
      {/* Header with Gradient */}
      <div className="bg-gradient-to-r from-teal-600 via-teal-700 to-cyan-700 text-white shadow-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl border border-white/30 shadow-lg">
                  <Calendar className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-extrabold">Admission Cycles</h1>
                  <p className="text-teal-100 text-sm mt-1">Manage cycles and control application periods</p>
                </div>
                <Sparkles className="h-5 w-5 text-teal-200 ml-2" />
              </div>

              {/* Stats Bar */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 border border-white/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-teal-100 text-xs font-medium uppercase">Total Cycles</p>
                      <p className="text-3xl font-bold text-white mt-1">{cycles.length}</p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-teal-200" />
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 border border-white/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-teal-100 text-xs font-medium uppercase">Active Cycles</p>
                      <p className="text-3xl font-bold text-white mt-1">
                        {cycles.filter(c => c.is_open).length}
                      </p>
                    </div>
                    <Unlock className="h-8 w-8 text-green-300" />
                  </div>
                </div>
                <div className="bg-white/10 backdrop-blur-sm rounded-lg px-4 py-3 border border-white/20">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-teal-100 text-xs font-medium uppercase">Completed</p>
                      <p className="text-3xl font-bold text-white mt-1">
                        {cycles.filter(c => c.phase === 'completed').length}
                      </p>
                    </div>
                    <CheckCircle2 className="h-8 w-8 text-teal-200" />
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-3 ml-6">
              <button
                onClick={() => router.push('/admin/dashboard')}
                className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 text-white rounded-lg hover:bg-white/30 transition-all shadow-lg hover:shadow-xl"
              >
                <Home className="h-4 w-4" />
                Dashboard
              </button>
              <button
                onClick={logout}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/80 backdrop-blur-sm border border-red-400/50 text-white rounded-lg hover:bg-red-600 transition-all shadow-lg hover:shadow-xl"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Create Cycle Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-600 to-cyan-700 text-white rounded-lg hover:from-teal-700 hover:to-cyan-800 transition-all font-semibold shadow-lg hover:shadow-xl hover:scale-[1.02]"
          >
            {showCreateForm ? (
              <>
                <ChevronUp className="h-5 w-5" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="h-5 w-5" />
                Create New Cycle
              </>
            )}
          </button>
        </div>

        {/* Create Cycle Form */}
        {showCreateForm && (
          <div className="bg-white rounded-2xl shadow-2xl mb-8 overflow-hidden border border-gray-200">
            <div className="bg-gradient-to-r from-teal-600 to-cyan-700 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Plus className="h-5 w-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">Create Admission Cycle</h2>
              </div>
            </div>

            <div className="p-6">
              {formError && (
                <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3">
                  <div className="flex-shrink-0 h-5 w-5 rounded-full bg-red-100 flex items-center justify-center">
                    <span className="text-red-600 text-xs font-bold">!</span>
                  </div>
                  <p className="text-sm text-red-700 flex-1">{formError}</p>
                </div>
              )}

              <form onSubmit={handleCreateCycle} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Cycle Name
                  </label>
                  <input
                    type="text"
                    value={formData.cycle_name}
                    onChange={(e) => setFormData({ ...formData, cycle_name: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent shadow-sm"
                    placeholder="e.g., Fall 2025 Admissions"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Maximum Seats
                  </label>
                  <input
                    type="number"
                    value={formData.max_seats}
                    onChange={(e) => setFormData({ ...formData, max_seats: parseInt(e.target.value) || 1 })}
                    required
                    min="1"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent shadow-sm"
                    placeholder="e.g., 100"
                  />
                </div>

                <div className="rounded-lg bg-teal-50 border border-teal-200 p-4">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-teal-600 mt-0.5" />
                    <p className="text-sm text-teal-800">
                      <strong>Timezone:</strong> Enter dates in <strong>your local time (PKT, UTC+5)</strong>.
                      The system will automatically convert and store them in UTC. Displayed times will show in PKT.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Start Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent shadow-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1.5">When admissions open (local time)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      End Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent shadow-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1.5">Application deadline (local time)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Result Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      value={formData.result_date}
                      onChange={(e) => setFormData({ ...formData, result_date: e.target.value })}
                      required
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent shadow-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1.5">When results are published (local time)</p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={processing === 'create'}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-700 text-white rounded-lg hover:from-teal-700 hover:to-cyan-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg"
                  >
                    {processing === 'create' ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Create Cycle
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setFormError('');
                    }}
                    className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Cycles List */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-teal-600" />
            <h2 className="text-xl font-bold text-gray-900">All Admission Cycles</h2>
          </div>

          {cycles.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center border border-gray-200">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-100 mb-4">
                <Calendar className="h-8 w-8 text-teal-600" />
              </div>
              <p className="text-lg font-semibold text-gray-900 mb-2">No admission cycles created yet</p>
              <p className="text-sm text-gray-500">Create your first cycle to start managing admissions</p>
            </div>
          ) : (
            <div className="space-y-6">
              {cycles.map((cycle) => {
                const status = cycleStatuses[cycle.cycle_id];
                const availableActions = getAvailableActions(cycle);
                const isExpanded = expandedCycle === cycle.cycle_id;

                return (
                  <div key={cycle.cycle_id} className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-200 hover:shadow-xl transition-shadow">
                    {/* Cycle Card Header */}
                    <div className="bg-gradient-to-r from-teal-600 to-cyan-700 px-6 py-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="p-2 bg-white/20 rounded-lg">
                            <Calendar className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-white">{cycle.cycle_name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                cycle.phase === 'completed'
                                  ? 'bg-green-400 text-green-900'
                                  : 'bg-white/30 text-white backdrop-blur-sm'
                              }`}>
                                {cycle.phase.replace('_', ' ').toUpperCase()}
                              </span>
                              {cycle.is_open ? (
                                <span className="px-2.5 py-1 bg-green-400 text-green-900 rounded-full text-xs font-semibold flex items-center gap-1">
                                  <Unlock className="h-3 w-3" />
                                  OPEN
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-red-400 text-red-900 rounded-full text-xs font-semibold flex items-center gap-1">
                                  <Lock className="h-3 w-3" />
                                  CLOSED
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setExpandedCycle(isExpanded ? null : cycle.cycle_id)}
                            className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm border border-white/30 text-white rounded-lg hover:bg-white/30 transition-all text-sm font-medium"
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="h-4 w-4" />
                                Collapse
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4" />
                                Expand
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Cycle Stats Grid */}
                    <div className="p-6 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200">
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                        <div className="text-center">
                          <Users className="h-5 w-5 text-teal-600 mx-auto mb-1" />
                          <p className="text-xs text-gray-500 uppercase font-medium">Applications</p>
                          <p className="text-xl font-bold text-gray-900 mt-1">{cycle.current_seats}</p>
                          <p className="text-xs text-gray-500">submitted</p>
                        </div>

                        <div className="text-center">
                          <Target className="h-5 w-5 text-cyan-600 mx-auto mb-1" />
                          <p className="text-xs text-gray-500 uppercase font-medium">Target Seats</p>
                          <p className="text-xl font-bold text-gray-900 mt-1">{cycle.max_seats}</p>
                          <p className="text-xs text-gray-500">to select</p>
                        </div>

                        <div className="text-center">
                          <Award className="h-5 w-5 text-green-600 mx-auto mb-1" />
                          <p className="text-xs text-gray-500 uppercase font-medium">Selected</p>
                          <p className="text-xl font-bold text-gray-900 mt-1">{cycle.selected_count || 0}</p>
                          <p className="text-xs text-gray-500">finalized</p>
                        </div>

                        <div className="text-center">
                          <Clock className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                          <p className="text-xs text-gray-500 uppercase font-medium">Start</p>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            {formatInPKT(cycle.start_date).date}
                          </p>
                          <p className="text-xs text-gray-500">{formatInPKT(cycle.start_date).time}</p>
                        </div>

                        <div className="text-center">
                          <Clock className="h-5 w-5 text-orange-600 mx-auto mb-1" />
                          <p className="text-xs text-gray-500 uppercase font-medium">Deadline</p>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            {formatInPKT(cycle.end_date).date}
                          </p>
                          <p className="text-xs text-gray-500">{formatInPKT(cycle.end_date).time}</p>
                        </div>

                        <div className="text-center">
                          <Clock className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                          <p className="text-xs text-gray-500 uppercase font-medium">Results</p>
                          <p className="text-sm font-semibold text-gray-900 mt-1">
                            {formatInPKT(cycle.result_date).date}
                          </p>
                          <p className="text-xs text-gray-500">{formatInPKT(cycle.result_date).time}</p>
                        </div>

                        <div className="text-center">
                          <Settings className="h-5 w-5 text-gray-600 mx-auto mb-1" />
                          <p className="text-xs text-gray-500 uppercase font-medium">Cycle ID</p>
                          <p className="text-xs font-mono text-gray-900 mt-1 break-all">{cycle.cycle_id}</p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons Bar */}
                    <div className="px-6 py-4 bg-white border-b border-gray-200 flex flex-wrap gap-3">
                      {cycle.is_open ? (
                        <button
                          onClick={() => handleCloseCycle(cycle.cycle_id)}
                          disabled={processing === cycle.cycle_id}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold shadow-lg hover:shadow-xl"
                        >
                          {processing === cycle.cycle_id ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Closing...
                            </>
                          ) : (
                            <>
                              <Lock className="h-4 w-4" />
                              Close Cycle
                            </>
                          )}
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleOpenCycle(cycle.cycle_id)}
                            disabled={processing === cycle.cycle_id}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold shadow-lg hover:shadow-xl"
                          >
                            {processing === cycle.cycle_id ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Opening...
                              </>
                            ) : (
                              <>
                                <Unlock className="h-4 w-4" />
                                Open Cycle
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => handleDeleteCycle(cycle)}
                            disabled={deletingCycleId === cycle.cycle_id || processing === cycle.cycle_id}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
                          >
                            {deletingCycleId === cycle.cycle_id ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              <>
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </>
                            )}
                          </button>
                        </>
                      )}
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="p-6 bg-gray-50">
                        {/* Phase Progress */}
                        <div className="mb-6">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3 uppercase">Phase Progress</h4>
                          <PhaseProgress currentPhase={cycle.phase} />
                        </div>

                        {/* Application Status */}
                        {status && (
                          <div className="mb-6">
                            <h4 className="text-sm font-semibold text-gray-700 mb-4 uppercase">Application Status</h4>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                              <div className="bg-white rounded-lg p-4 text-center shadow-md border border-gray-200">
                                <p className="text-2xl font-bold text-primary-600">{status.stats.total_applications}</p>
                                <p className="text-xs text-gray-600 mt-1 uppercase font-medium">Total</p>
                              </div>
                              <div className="bg-white rounded-lg p-4 text-center shadow-md border border-gray-200">
                                <p className="text-2xl font-bold text-yellow-600">{status.stats.submitted}</p>
                                <p className="text-xs text-gray-600 mt-1 uppercase font-medium">Submitted</p>
                              </div>
                              <div className="bg-white rounded-lg p-4 text-center shadow-md border border-gray-200">
                                <p className="text-2xl font-bold text-purple-600">{status.stats.finalized}</p>
                                <p className="text-xs text-gray-600 mt-1 uppercase font-medium">Finalized</p>
                              </div>
                              <div className="bg-white rounded-lg p-4 text-center shadow-md border border-gray-200">
                                <p className="text-2xl font-bold text-green-600">{status.stats.scored}</p>
                                <p className="text-xs text-gray-600 mt-1 uppercase font-medium">Scored</p>
                              </div>
                              <div className="bg-white rounded-lg p-4 text-center shadow-md border border-gray-200">
                                <p className="text-2xl font-bold text-indigo-600">{status.stats.selected}</p>
                                <p className="text-xs text-gray-600 mt-1 uppercase font-medium">Selected</p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Phase Actions */}
                        {availableActions.length > 0 && (
                          <div className="mb-6">
                            <h4 className="text-sm font-semibold text-gray-700 mb-4 uppercase">Phase Actions</h4>
                            <div className="flex flex-wrap gap-3">
                              {availableActions.map((action) => (
                                <div key={action.key}>
                                  <button
                                    onClick={() => handlePhaseTransition(cycle.cycle_id, action.key)}
                                    disabled={processing !== null}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl ${
                                      action.variant === 'primary'
                                        ? 'bg-gradient-to-r from-teal-600 to-cyan-700 text-white hover:from-teal-700 hover:to-cyan-800'
                                        : 'bg-gray-600 text-white hover:bg-gray-700'
                                    }`}
                                  >
                                    {processing === cycle.cycle_id ? (
                                      <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Processing...
                                      </>
                                    ) : (
                                      <>
                                        <Settings className="h-4 w-4" />
                                        {action.label}
                                      </>
                                    )}
                                  </button>
                                  {action.description && (
                                    <p className="text-xs text-gray-500 mt-2 max-w-xs">{action.description}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Batch Management - Show for PROCESSING and SCORED phases */}
                        {(cycle.phase === 'processing' || cycle.phase === 'scored') && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-4 uppercase">Batch Management</h4>
                            <BatchManagement
                              cycleId={cycle.cycle_id}
                              onImportSuccess={() => loadCycles()}
                            />
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
      </main>
    </div>
  );
}
