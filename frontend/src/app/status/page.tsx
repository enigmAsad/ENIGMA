/**
 * Legacy status page - redirects to student dashboard
 * All status checking functionality is now integrated in the student dashboard
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useStudentAuth';

export default function StatusRedirectPage() {
  const router = useRouter();
  const { student, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (student) {
        // Redirect authenticated students to their dashboard
        router.push('/student/dashboard');
      } else {
        // Redirect unauthenticated users to login
        router.push('/student/login');
      }
    }
  }, [student, loading, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
}
