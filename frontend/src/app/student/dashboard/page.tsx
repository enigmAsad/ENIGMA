'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useStudentAuth';
import { adminApiClient } from '@/lib/adminApi';
import { type AdmissionInfo } from '@/lib/adminApi';
import ApplicationForm from '@/components/ApplicationForm';
import ApplicationStatus from '@/components/ApplicationStatus';

export default function StudentDashboardPage() {
  const { student, loading, error, logout, refreshStudent } = useAuth();
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

  const handleApplicationSuccess = async (applicationId: string) => {
    // Refresh student data to get the new application status
    await refreshStudent();
  };

  if (loading || admissionLoading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

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
        <div className="bg-gray-800/50 p-6 rounded-lg shadow-xl ring-1 ring-white/10">
          <div className="mb-6">
            <p className="text-lg">Welcome, <strong className="font-semibold">{student.display_name || student.primary_email}</strong>!</p>
            <p className="text-sm text-gray-400">Student ID: {student.student_id}</p>
          </div>

          {student.application ? (
            <ApplicationStatus 
              status={student.application.status} 
              results={student.application.results} 
            />
          ) : admissionInfo?.is_open ? (
            <ApplicationForm 
              student={student} 
              admissionInfo={admissionInfo} 
              onApplicationSuccess={handleApplicationSuccess} 
            />
          ) : (
            <div className="text-center py-12">
              <h2 className="text-2xl font-semibold mb-2 text-white">Admissions Are Currently Closed</h2>
              <p className="text-gray-400">
                We are not accepting applications at this time. Please check back later.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}