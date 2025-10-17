/**
 * Student Apply Page - Browse and apply to open admission cycles
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useStudentAuth';
import { adminApiClient, type AdmissionCycle, type AdmissionInfo } from '@/lib/adminApi';
import { studentApiClient } from '@/lib/studentApi';
import Card from '@/components/Card';
import Button from '@/components/Button';
import ApplicationForm from '@/components/ApplicationForm';

export default function StudentApplyPage() {
  const { student, loading: authLoading } = useAuth();
  const router = useRouter();

  const [cycles, setCycles] = useState<AdmissionCycle[]>([]);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [admissionInfo, setAdmissionInfo] = useState<AdmissionInfo | null>(null);

  useEffect(() => {
    if (!authLoading && !student) {
      router.push('/student/login');
    }
  }, [authLoading, student, router]);

  useEffect(() => {
    const loadOpenCycles = async () => {
      try {
        // Get all cycles (would need admin endpoint or public endpoint)
        // For now, get the current admission info
        const info = await adminApiClient.getAdmissionInfo();
        setAdmissionInfo(info);
      } catch (error) {
        console.error('Failed to load cycles:', error);
      } finally {
        setLoadingCycles(false);
      }
    };

    if (student) {
      loadOpenCycles();
    }
  }, [student]);

  const handleApplicationSuccess = (applicationId: string) => {
    // Redirect to dashboard after successful application
    router.push('/student/dashboard');
  };

  if (authLoading || loadingCycles) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!student) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Apply to Admission Cycles</h1>
          <p className="text-lg text-gray-300">
            Submit your application to open admission cycles below
          </p>
        </div>

        {/* Admission Status Banner */}
        {admissionInfo && (
          <div className={`mb-6 rounded-lg p-4 ${
            admissionInfo.is_open
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`font-semibold ${
                  admissionInfo.is_open ? 'text-green-900' : 'text-red-900'
                }`}>
                  {admissionInfo.is_open
                    ? `Admissions Open: ${admissionInfo.cycle_name}`
                    : 'No Open Admissions'}
                </p>
                {admissionInfo.is_open && (
                  <p className={`text-sm mt-1 ${
                    admissionInfo.is_open ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {admissionInfo.max_seats && `${admissionInfo.max_seats} seats available`}
                    {admissionInfo.end_date && (
                      <> • Deadline: {new Date(admissionInfo.end_date).toLocaleDateString()}</>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Application Form for Active Cycle */}
        {admissionInfo?.is_open && !student.application && (
          <Card className="mb-8">
            <ApplicationForm
              student={student}
              admissionInfo={admissionInfo}
              onApplicationSuccess={handleApplicationSuccess}
            />
          </Card>
        )}

        {/* Already Applied Message */}
        {student.application && (
          <Card className="mb-8">
            <div className="text-center py-8">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-green-600 mb-2">
                Application Already Submitted
              </h2>
              <p className="text-gray-700 mb-4">
                You have already submitted an application for the current admission cycle.
              </p>
              <p className="text-sm text-gray-600 mb-6">
                Application ID: <span className="font-mono font-bold">{student.application.status.application_id}</span>
              </p>
              <Button onClick={() => router.push('/student/dashboard')}>
                View My Dashboard
              </Button>
            </div>
          </Card>
        )}

        {/* No Open Cycles */}
        {!admissionInfo?.is_open && (
          <Card>
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🚫</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                No Open Admissions
              </h2>
              <p className="text-gray-600 mb-6">
                {admissionInfo?.message || 'Applications are not being accepted at this time. Please check back later.'}
              </p>
              <Button onClick={() => router.push('/student/dashboard')} variant="outline">
                Go to Dashboard
              </Button>
            </div>
          </Card>
        )}

        {/* Help Section */}
        <Card className="mt-8 bg-blue-50 border-blue-200">
          <h3 className="font-semibold text-blue-900 mb-2">Need Help?</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• You can only apply to one admission cycle at a time</li>
            <li>• Once submitted, your application cannot be edited</li>
            <li>• Check your dashboard for application status and results</li>
            <li>• All personal information will be anonymized before evaluation</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
