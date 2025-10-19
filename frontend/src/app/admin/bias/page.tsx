"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { adminApiClient, BiasFlag, BiasMetrics } from "@/lib/adminApi";
import Card from "@/components/Card";
import Button from "@/components/Button";

export default function AdminBiasDashboard() {
  const { isAuthenticated, isLoading, logout } = useAdminAuth();
  const router = useRouter();

  const [flags, setFlags] = useState<BiasFlag[]>([]);
  const [metrics, setMetrics] = useState<BiasMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [showReviewed, setShowReviewed] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");

  // Modal state
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

      // Load flags with filters
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

      // Refresh data
      await loadData();

      // Close modal
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading bias monitoring dashboard...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Bias Monitoring Dashboard
              </h1>
              <p className="text-gray-600 mt-1">
                Monitor evaluator bias and review flagged incidents
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => router.push("/admin/dashboard")}
              >
                ← Back to Dashboard
              </Button>
              <Button variant="outline" onClick={() => loadData()}>
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Overview Cards */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <div className="p-6">
                <div className="text-sm font-medium text-gray-600">
                  Active Flags
                </div>
                <div className="text-3xl font-bold text-gray-900 mt-2">
                  {flags.filter((f) => !f.reviewed).length}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Requiring Review
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <div className="text-sm font-medium text-gray-600">
                  Suspended Admins
                </div>
                <div className="text-3xl font-bold text-orange-600 mt-2">
                  {metrics.summary.suspended_admins}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Out of {metrics.summary.total_admins} total
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <div className="text-sm font-medium text-gray-600">
                  Total Incidents
                </div>
                <div className="text-3xl font-bold text-red-600 mt-2">
                  {metrics.summary.total_incidents}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Across {metrics.summary.total_interviews} interviews
                </div>
              </div>
            </Card>

            <Card>
              <div className="p-6">
                <div className="text-sm font-medium text-gray-600">
                  Incident Rate
                </div>
                <div className="text-3xl font-bold text-gray-900 mt-2">
                  {metrics.summary.incident_rate}%
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  System-wide average
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Bias Flags Table */}
        <Card title="Bias Flags" className="mb-8">
          <div className="p-6">
            {/* Filters */}
            <div className="flex gap-4 mb-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={showReviewed}
                  onChange={(e) => setShowReviewed(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">Show Reviewed</span>
              </label>

              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="border border-gray-300 rounded-md px-3 py-1 text-sm"
              >
                <option value="all">All Severities</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            {/* Table */}
            {flags.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                No bias flags found. {!showReviewed && "All incidents reviewed! ✅"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Interview
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Admin
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Severity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {flags.map((flag) => (
                      <tr key={flag.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          #{flag.interview_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {flag.admin_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${getSeverityBadgeColor(
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
                            <span className="text-green-600">✓ Reviewed</span>
                          ) : (
                            <span className="text-orange-600">Pending</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          {!flag.reviewed && (
                            <button
                              onClick={() => setSelectedFlag(flag)}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
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
        </Card>

        {/* Admin Risk Scoreboard */}
        {metrics && metrics.admin_risks.length > 0 && (
          <Card title="Admin Risk Scoreboard" className="mb-8">
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Admin ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Strikes
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Interviews
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Incidents
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Incident Rate
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {metrics.admin_risks.map((admin) => (
                      <tr key={admin.admin_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {admin.admin_id}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeColor(
                              admin.current_status
                            )}`}
                          >
                            {admin.current_status.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {admin.strikes}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {admin.total_interviews}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {admin.total_incidents}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {admin.incident_rate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Resolution Modal */}
      {selectedFlag && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  Review Bias Flag #{selectedFlag.id}
                </h2>
                <button
                  onClick={() => setSelectedFlag(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <span className="text-sm font-medium text-gray-600">
                    Severity:
                  </span>
                  <span
                    className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${getSeverityBadgeColor(
                      selectedFlag.severity
                    )}`}
                  >
                    {selectedFlag.severity.toUpperCase()}
                  </span>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-600">
                    Type:
                  </span>
                  <span className="ml-2 text-sm text-gray-900">
                    {selectedFlag.flag_type}
                  </span>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-600">
                    Description:
                  </span>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedFlag.description}
                  </p>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-600">
                    Evidence:
                  </span>
                  <pre className="mt-1 text-xs bg-gray-50 p-3 rounded border border-gray-200 overflow-auto">
                    {JSON.stringify(selectedFlag.evidence, null, 2)}
                  </pre>
                </div>

                <div>
                  <span className="text-sm font-medium text-gray-600">
                    Action Taken:
                  </span>
                  <p className="mt-1 text-sm text-gray-900">
                    {selectedFlag.action_taken}
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Resolution Notes
                </label>
                <textarea
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  rows={4}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your resolution notes..."
                />
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setSelectedFlag(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleResolveFlag}
                  isLoading={resolving}
                  disabled={!resolution.trim()}
                >
                  Mark as Resolved
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
