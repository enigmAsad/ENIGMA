/**
 * Student Apply Page - Browse and apply to open admission cycles
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useStudentAuth';
import { adminApiClient, type AdmissionCycle, type AdmissionInfo } from '@/lib/adminApi';
import { studentApiClient } from '@/lib/studentApi';
import ApplicationForm from '@/components/ApplicationForm';
import { SkeletonForm } from '@/components/Skeleton';
import {
  FileText, CheckCircle2, Lock, Unlock, Calendar,
  Users, Clock, Info, Sparkles, ArrowRight, Loader2,
  AlertCircle
} from 'lucide-react';

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
    router.push('/student/dashboard');
  };

  if (authLoading || loadingCycles) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-primary-50 to-indigo-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8">
            <SkeletonForm fields={8} />
          </div>
        </div>
      </div>
    );
  }

  if (!student) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-primary-50 to-indigo-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center">
              <FileText className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-2">
                Apply Now
                <Sparkles className="h-8 w-8 text-yellow-300" />
              </h1>
              <p className="text-primary-100 mt-1">Submit your application to join ENIGMA</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Admission Status Banner */}
        {admissionInfo && (
          <div className={`mb-8 rounded-2xl shadow-lg overflow-hidden ${
            admissionInfo.is_open
              ? 'bg-gradient-to-r from-primary-500 to-indigo-600'
              : 'bg-gradient-to-r from-gray-500 to-slate-600'
          }`}>
            <div className="p-6 text-white">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 h-12 w-12 rounded-lg bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center">
                  {admissionInfo.is_open ? (
                    <Unlock className="h-6 w-6" />
                  ) : (
                    <Lock className="h-6 w-6" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2">
                    {admissionInfo.is_open
                      ? `✅ Admissions Open: ${admissionInfo.cycle_name}`
                      : '🔒 No Open Admissions'}
                  </h3>
                  {admissionInfo.is_open && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                        <div className="flex items-center gap-2 mb-1">
                          <Users className="h-4 w-4" />
                          <p className="text-xs text-white/80">Seats Available</p>
                        </div>
                        <p className="text-2xl font-bold">{admissionInfo.max_seats}</p>
                      </div>
                      {admissionInfo.end_date && (
                        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                          <div className="flex items-center gap-2 mb-1">
                            <Calendar className="h-4 w-4" />
                            <p className="text-xs text-white/80">Deadline</p>
                          </div>
                          <p className="text-sm font-bold">{new Date(admissionInfo.end_date).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}</p>
                        </div>
                      )}
                      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-4 w-4" />
                          <p className="text-xs text-white/80">Status</p>
                        </div>
                        <p className="text-sm font-bold">Accepting Applications</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Application Form for Active Cycle */}
        {admissionInfo?.is_open && !student.application && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-primary-500 to-indigo-600 px-6 py-4">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <FileText className="h-6 w-6" />
                Application Form
              </h2>
            </div>
            <div className="p-8">
              <ApplicationForm
                student={student}
                admissionInfo={admissionInfo}
                onApplicationSuccess={handleApplicationSuccess}
              />
            </div>
          </div>
        )}

        {/* Already Applied Message */}
        {student.application && (
          <div className="bg-white rounded-2xl shadow-xl border-2 border-green-200 overflow-hidden">
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-6">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-green-900 mb-3">
                Application Already Submitted!
              </h2>
              <p className="text-gray-700 mb-2 text-lg">
                You have already submitted an application for the current admission cycle.
              </p>
              <div className="inline-flex items-center gap-2 mt-4 mb-8 px-6 py-3 bg-green-50 rounded-lg border border-green-200">
                <span className="text-sm text-gray-600">Application ID:</span>
                <span className="font-mono font-bold text-green-700 text-lg">{student.application.status.application_id}</span>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => router.push('/student/dashboard')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all font-medium shadow-md hover:shadow-lg"
                >
                  View Dashboard
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => router.push('/student/applications')}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium"
                >
                  <FileText className="h-4 w-4" />
                  View Application
                </button>
              </div>
            </div>
          </div>
        )}

        {/* No Open Cycles */}
        {!admissionInfo?.is_open && (
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="p-12 text-center">
              <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-gray-100 mb-6">
                <Lock className="h-10 w-10 text-gray-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3">
                No Open Admissions
              </h2>
              <p className="text-gray-600 mb-8 max-w-md mx-auto text-lg">
                {admissionInfo?.message || 'Applications are not being accepted at this time. Please check back later for upcoming admission cycles.'}
              </p>
              <button
                onClick={() => router.push('/student/dashboard')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-all font-medium shadow-md hover:shadow-lg"
              >
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-8 bg-gradient-to-r from-primary-600 to-indigo-700 rounded-2xl shadow-lg p-6 text-white">
          <div className="flex items-center gap-2 mb-4">
            <Info className="h-5 w-5" />
            <h3 className="text-lg font-bold">Important Information</h3>
          </div>
          <ul className="space-y-2 text-sm text-white/90">
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 mt-1">•</span>
              <span>You can only apply to one admission cycle at a time</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 mt-1">•</span>
              <span>Once submitted, your application cannot be edited</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 mt-1">•</span>
              <span>Check your dashboard for application status and results</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 mt-1">•</span>
              <span>All personal information will be anonymized before evaluation</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0 mt-1">•</span>
              <span>Results are cryptographically secured and verifiable</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
