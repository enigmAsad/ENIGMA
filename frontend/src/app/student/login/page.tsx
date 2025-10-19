
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useStudentAuth';

export default function StudentLoginPage() {
  const { student, login, loading, error } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (student) {
      router.push('/student/dashboard');
    }
  }, [student, router]);

  if (loading || student) {
    return <div>Loading...</div>; // Or a spinner
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-4">Student Login</h1>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <button
          onClick={login}
          className="w-full bg-primary-500 text-white py-2 rounded-md hover:bg-primary-600"
        >
          Login with Google
        </button>
      </div>
    </div>
  );
}
