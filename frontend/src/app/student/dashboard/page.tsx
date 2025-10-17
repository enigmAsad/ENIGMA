'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useStudentAuth';
import { adminApiClient } from '@/lib/adminApi';
import { type AdmissionInfo } from '@/lib/adminApi';

export default function StudentDashboardPage() {
  const { student, loading, error, logout } = useAuth();
  const router = useRouter();
  const [admissionInfo, setAdmissionInfo] = useState<AdmissionInfo | null>(null);
  const [admissionLoading, setAdmissionLoading] = useState(true);

  useEffect(() => {
    if (!loading && !student) {
      router.push('/student/login');
    }
  }, [student, loading, router]);

  useEffect(() => {
    const fetchAdmissionInfo = async () => {
      try {
        const info = await adminApiClient.getAdmissionInfo();
        setAdmissionInfo(info);
      } catch (error) {
        console.error('Failed to fetch admission info:', error);
      } finally {
        setAdmissionLoading(false);
      }
    };

    fetchAdmissionInfo();
  }, []);

  if (loading || admissionLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  const hasResults = student?.application?.results !== null && student?.application?.results !== undefined;
  const applicationStatus = student?.application?.status?.status;
  const isResultPublished = hasResults && ['selected', 'not_selected', 'published'].includes(applicationStatus || '');

  return (
    <div className="container mx-auto p-4 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Student Dashboard</h1>
        <button
          onClick={logout}
          className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 transition-colors"
        >
          Logout
        </button>
      </div>

      {error && <p className="text-red-400 bg-red-900/50 p-4 rounded-lg mb-4">Error: {error}</p>}

      {student && (
        <div className="space-y-6">
          {/* Student Profile Section */}
          <div className="bg-gray-800/50 p-6 rounded-lg shadow-xl ring-1 ring-white/10">
            <h2 className="text-xl font-semibold mb-4 text-white">Profile Information</h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Name:</span>
                <span className="text-white font-medium">{student.display_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Email:</span>
                <span className="text-white font-medium">{student.primary_email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Student ID:</span>
                <span className="text-white font-mono font-medium">{student.student_id}</span>
              </div>
            </div>
          </div>

          {/* Notifications Section */}
          <div className="bg-gray-800/50 p-6 rounded-lg shadow-xl ring-1 ring-white/10">
            <h2 className="text-xl font-semibold mb-4 text-white">📢 Notifications</h2>
            <div className="space-y-4">

              {/* Results Published Notification */}
              {isResultPublished && (
                <div className={`border rounded-lg p-4 ${
                  student.application?.results?.status === 'selected'
                    ? 'bg-green-900/30 border-green-700'
                    : 'bg-gray-900/50 border-gray-700'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">
                        {student.application?.results?.status === 'selected' ? '🎉' : '📝'}
                      </span>
                      <div>
                        <h3 className={`font-semibold ${
                          student.application?.results?.status === 'selected'
                            ? 'text-green-400'
                            : 'text-gray-300'
                        }`}>
                          {student.application?.results?.status === 'selected'
                            ? 'Congratulations! You\'ve Been Selected!'
                            : 'Results Published'}
                        </h3>
                        <p className="text-sm text-gray-400">
                          Your evaluation results are now available
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push('/student/applications')}
                      className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              )}

              {/* Admission Status Notification */}
              {admissionInfo ? (
                admissionInfo.is_open ? (
                  <div className="bg-green-900/30 border border-green-700 rounded-lg p-4">
                    <div className="flex items-start">
                      <span className="text-2xl mr-3">✅</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-green-400 mb-1">
                          Admissions Open for {admissionInfo.cycle_name}
                        </h3>
                        <p className="text-sm text-green-300 mb-2">
                          {admissionInfo.seats_available} of {admissionInfo.max_seats} seats available
                        </p>
                        {admissionInfo.end_date && (
                          <p className="text-sm text-green-300">
                            Deadline: {new Date(admissionInfo.end_date).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                    <div className="flex items-start">
                      <span className="text-2xl mr-3">🔒</span>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-400 mb-1">
                          Admissions Currently Closed
                        </h3>
                        <p className="text-sm text-gray-500">
                          We are not accepting applications at this time. Check back later for updates.
                        </p>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
                  <div className="flex items-start">
                    <span className="text-2xl mr-3">ℹ️</span>
                    <div className="flex-1">
                      <p className="text-sm text-gray-500">No admission information available.</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Application Not Submitted Yet */}
              {!student.application && admissionInfo?.is_open && (
                <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">⚡</span>
                      <div>
                        <h3 className="font-semibold text-yellow-400">
                          Ready to Apply?
                        </h3>
                        <p className="text-sm text-yellow-300">
                          You haven't submitted an application yet. Admissions are open!
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push('/apply')}
                      className="bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                    >
                      Apply Now
                    </button>
                  </div>
                </div>
              )}

              {/* Application In Progress (not yet published) */}
              {student.application && !isResultPublished && (
                <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">⏳</span>
                      <div>
                        <h3 className="font-semibold text-blue-400">Application In Progress</h3>
                        <p className="text-sm text-blue-300">
                          Your application is being evaluated. Check back for updates.
                        </p>
                        <p className="text-xs text-blue-400 mt-1">
                          Status: {applicationStatus?.replace(/_/g, ' ').toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push('/student/applications')}
                      className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                      Track Status
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-gray-800/50 p-6 rounded-lg shadow-xl ring-1 ring-white/10">
            <h2 className="text-xl font-semibold mb-4 text-white">Quick Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => router.push('/student/applications')}
                className="bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📋</span>
                  <div>
                    <h3 className="font-semibold">My Applications</h3>
                    <p className="text-sm text-blue-200">View all submissions and results</p>
                  </div>
                </div>
              </button>

              {admissionInfo?.is_open && !student.application && (
                <button
                  onClick={() => router.push('/apply')}
                  className="bg-green-600 text-white p-4 rounded-lg hover:bg-green-700 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">✍️</span>
                    <div>
                      <h3 className="font-semibold">Submit Application</h3>
                      <p className="text-sm text-green-200">Apply for {admissionInfo.cycle_name}</p>
                    </div>
                  </div>
                </button>
              )}

              <button
                onClick={() => router.push('/verify')}
                className="bg-gray-700 text-white p-4 rounded-lg hover:bg-gray-600 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔐</span>
                  <div>
                    <h3 className="font-semibold">Verify Results</h3>
                    <p className="text-sm text-gray-300">Check cryptographic integrity</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => router.push('/dashboard')}
                className="bg-gray-700 text-white p-4 rounded-lg hover:bg-gray-600 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📊</span>
                  <div>
                    <h3 className="font-semibold">Public Dashboard</h3>
                    <p className="text-sm text-gray-300">View system statistics</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
