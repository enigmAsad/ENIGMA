
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useStudentAuth';

export default function StudentDashboardPage() {
  const { student, loading, error, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !student) {
      router.push('/student/login');
    }
  }, [student, loading, router]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Student Dashboard</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {student && (
        <div className="bg-white p-4 rounded-lg shadow-md">
          <p><strong>ID:</strong> {student.student_id}</p>
          <p><strong>Email:</strong> {student.primary_email}</p>
          <p><strong>Status:</strong> {student.status}</p>
          <button
            onClick={logout}
            className="mt-4 bg-red-500 text-white py-2 px-4 rounded-md hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
