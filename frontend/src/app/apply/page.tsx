'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useStudentAuth';
import { adminApiClient } from '@/lib/adminApi';
import { type AdmissionInfo } from '@/lib/adminApi';
import ApplicationForm from '@/components/ApplicationForm';

export default function ApplyPage() {
  const { student, loading } = useAuth();
  const router = useRouter();
  const [admissionInfo, setAdmissionInfo] = useState<AdmissionInfo | null>(null);
  const [admissionLoading, setAdmissionLoading] = useState(true);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !student) {
      router.push('/student/login');
    }
  }, [student, loading, router]);

  // Fetch admission info
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
    // Redirect to status page with the application ID
    router.push(`/status?id=${applicationId}`);
  };

  if (loading || admissionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if student already has an application
  if (student?.application) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-semibold mb-2 text-yellow-900">
            Application Already Submitted
          </h2>
          <p className="text-yellow-800 mb-6">
            You have already submitted an application for the current admission cycle.
            Only one application per cycle is allowed.
          </p>
          <button
            onClick={() => router.push('/student/dashboard')}
            className="bg-primary-600 text-white py-2 px-6 rounded-md hover:bg-primary-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Check if admissions are closed
  if (!admissionInfo?.is_open) {
    return (
      <div className="container mx-auto p-4 md:p-8">
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-8 text-center ring-1 ring-white/10">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-semibold mb-2 text-white">
            Admissions Are Currently Closed
          </h2>
          <p className="text-gray-400 mb-6">
            We are not accepting applications at this time. Please check back later.
          </p>
          <button
            onClick={() => router.push('/student/dashboard')}
            className="bg-primary-600 text-white py-2 px-6 rounded-md hover:bg-primary-700 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Render the application form
  return (
    <div className="container mx-auto p-4 md:p-8">
      {student && admissionInfo && (
        <ApplicationForm
          student={student}
          admissionInfo={admissionInfo}
          onApplicationSuccess={handleApplicationSuccess}
        />
      )}
    </div>
  );
}
