"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { adminApiClient, BiasFlag, BiasMetrics } from "@/lib/adminApi";
import {
  Shield, AlertTriangle, Users, Activity, Filter, Eye,
  XCircle, CheckCircle2, Loader2, AlertCircle, BarChart3,
  TrendingUp, Clock, Calendar, User, FileText, Sparkles,
  RefreshCw, ChevronRight
} from "lucide-react";

export default function AdminBiasDashboard() {
  const { isAuthenticated, isLoading, logout } = useAdminAuth();
  const router = useRouter();

  const [flags, setFlags] = useState<BiasFlag[]>([]);
  const [metrics, setMetrics] = useState<BiasMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showReviewed, setShowReviewed] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");

  const [selectedFlag, setSelectedFlag] = useState<BiasFlag | null>(null);
  const [resolution, setResolution] = useState("");
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/admin/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, showReviewed, selectedSeverity]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const filters: any = {};
      if (!showReviewed) filters.reviewed = false;
      if (selectedSeverity !== "all") filters.severity = selectedSeverity;

      const [flagsData, metricsData] = await Promise.all([
        adminApiClient.getBiasFlags(filters),
        adminApiClient.getBiasMetrics(),
      ]);

      setFlags(flagsData);
      setMetrics(metricsData);
    } catch (err: any) {
      setError(err.message || "Failed to load bias data");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveFlag = async () => {
    if (!selectedFlag || !resolution.trim()) return;

    try {
      setResolving(true);
      await adminApiClient.resolveBiasFlag(selectedFlag.id, resolution);
      await loadData();
      setSelectedFlag(null);
      setResolution("");
    } catch (err: any) {
      alert(`Failed to resolve flag: ${err.message}`);
    } finally {
      setResolving(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800";
      case "warned":
        return "bg-yellow-100 text-yellow-800";
      case "suspended":
        return "bg-red-100 text-red-800";
      case "banned":
        return "bg-gray-900 text-white";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-600 text-white";
      case "high":
        return "bg-orange-500 text-white";
      default:
        return "bg-gray-500 text-white";
    }
  };

  if (isLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading bias monitoring data...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <div className="h-20 w-20 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center ring-4 ring-white/10">
                  <Shield className="h-10 w-10 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h1 className="text-3xl font-bold">Bias Monitoring</h1>
                  <Sparkles className="h-6 w-6 text-yellow-300 flex-shrink-0" />
                </div>
                <p className="text-primary-100">Real-time evaluator bias detection and management</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => router.push("/admin/dashboard")}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 transition-all duration-200 font-medium text-sm hover:scale-105"
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
                Dashboard
              </button>
              <button
                onClick={() => loadData()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 transition-all duration-200 font-medium text-sm hover:scale-105"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>

          {/* Stats Bar */}
          {metrics && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white/80 text-sm">Active Flags</p>
                    <p className="text-2xl font-bold text-white">
                      {flags.filter((f) => !f.reviewed).length}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                    <XCircle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white/80 text-sm">Suspended</p>
                    <p className="text-2xl font-bold text-white">{metrics.summary.suspended_admins}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                    <Activity className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white/80 text-sm">Total Incidents</p>
                    <p className="text-2xl font-bold text-white">{metrics.summary.total_incidents}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white/80 text-sm">Incident Rate</p>
                    <p className="text-2xl font-bold text-white">{metrics.summary.incident_rate}%</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-white rounded-2xl border-2 border-red-200 p-6 mb-8 shadow-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-bold text-red-900 mb-1">Error Loading Data</h3>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Bias Flags Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-orange-500 to-red-600 px-6 py-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Bias Flags
            </h2>
          </div>

          <div className="p-6">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-gray-600" />
                <span className="text-sm font-medium text-gray-700">Filters:</span>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showReviewed}
                  onChange={(e) => setShowReviewed(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Show Reviewed</span>
              </label>

              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium focus:border-primary-500 focus:ring-primary-500"
              >
                <option value="all">All Severities</option>
                <option value="high">High Only</option>
                <option value="critical">Critical Only</option>
              </select>
            </div>

            {/* Table */}
            {flags.length === 0 ? (
              <div className="text-center py-16">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No Bias Flags Found</h3>
                <p className="text-gray-600">
                  {!showReviewed ? "All incidents have been reviewed! ✅" : "No flags match your current filters."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Interview
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Admin
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Severity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {flags.map((flag) => (
                      <tr key={flag.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          #{flag.interview_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                          {flag.admin_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 text-xs font-bold rounded-full ${getSeverityBadgeColor(
                              flag.severity
                            )}`}
                          >
                            {flag.severity.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {flag.flag_type}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(flag.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {flag.reviewed ? (
                            <span className="flex items-center gap-1 text-green-600 font-medium">
                              <CheckCircle2 className="h-4 w-4" />
                              Reviewed
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-orange-600 font-medium">
                              <Clock className="h-4 w-4" />
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          {!flag.reviewed && (
                            <button
                              onClick={() => setSelectedFlag(flag)}
                              className="inline-flex items-center gap-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-all"
                            >
                              <Eye className="h-4 w-4" />
                              Review
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Admin Risk Scoreboard */}
        {metrics && metrics.admin_risks.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-6 py-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Admin Risk Scoreboard
              </h2>
            </div>

            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Admin ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Strikes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Interviews
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Incidents
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Incident Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {metrics.admin_risks.map((admin) => (
                      <tr key={admin.admin_id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono font-medium text-gray-900">
                          {admin.admin_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 text-xs font-bold rounded-full ${getStatusBadgeColor(
                              admin.current_status
                            )}`}
                          >
                            {admin.current_status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                          {admin.strikes}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {admin.total_interviews}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {admin.total_incidents}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {admin.incident_rate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Resolution Modal */}
      {selectedFlag && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="bg-gradient-to-r from-primary-500 to-indigo-600 px-6 py-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Shield className="h-6 w-6" />
                  Review Bias Flag #{selectedFlag.id}
                </h2>
                <button
                  onClick={() => setSelectedFlag(null)}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <XCircle className="h-6 w-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <span className="text-xs font-medium text-gray-600 uppercase">Severity</span>
                  <div className="mt-2">
                    <span
                      className={`px-3 py-1 text-xs font-bold rounded-full ${getSeverityBadgeColor(
                        selectedFlag.severity
                      )}`}
                    >
                      {selectedFlag.severity.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <span className="text-xs font-medium text-gray-600 uppercase">Type</span>
                  <p className="mt-2 text-sm font-semibold text-gray-900">{selectedFlag.flag_type}</p>
                </div>
              </div>

              <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
                <span className="text-xs font-medium text-orange-700 uppercase flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Description
                </span>
                <p className="mt-2 text-sm text-gray-900">{selectedFlag.description}</p>
              </div>

              <div>
                <span className="text-xs font-medium text-gray-600 uppercase block mb-2">Evidence</span>
                <pre className="text-xs bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto border border-gray-700 font-mono">
                  {JSON.stringify(selectedFlag.evidence, null, 2)}
                </pre>
              </div>

              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                <span className="text-xs font-medium text-blue-700 uppercase flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Action Taken
                </span>
                <p className="mt-2 text-sm text-gray-900">{selectedFlag.action_taken}</p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">
                  Resolution Notes *
                </label>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  placeholder="Enter detailed resolution notes explaining the actions taken and outcome..."
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={() => setSelectedFlag(null)}
                  className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResolveFlag}
                  disabled={resolving || !resolution.trim()}
                  className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all font-medium shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {resolving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Resolving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      Mark as Resolved
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
