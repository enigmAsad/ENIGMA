
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { studentApiClient } from '@/lib/studentApi';
import { useAuth } from '@/hooks/useStudentAuth';
import { SkeletonCard } from '@/components/Skeleton';

export default function GoogleCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const { setStudent } = useAuth();

  useEffect(() => {
    const completeLogin = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const codeVerifier = sessionStorage.getItem('code_verifier');
      const redirectUri = sessionStorage.getItem('redirect_uri');

      if (code && state && codeVerifier && redirectUri) {
        try {
          const { student } = await studentApiClient.completeGoogleLogin(code, state, codeVerifier, redirectUri);
          setStudent(student);
          sessionStorage.removeItem('code_verifier');
          sessionStorage.removeItem('redirect_uri');
          router.push('/student/dashboard');
        } catch (err: any) {
          setError(err.message);
        }
      } else {
        setError('Missing code, state, verifier, or redirect URI from login flow');
      }
    };

    completeLogin();
  }, [searchParams, router, setStudent]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="max-w-md mx-auto px-4 py-12">
        {error ? (
          <div className="bg-white rounded-2xl shadow-xl border-2 border-red-200 p-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <span className="text-red-600 text-xl font-bold">!</span>
              </div>
              <h2 className="text-xl font-bold text-red-900 mb-2">Login Error</h2>
              <p className="text-red-700 mb-6">{error}</p>
              <button
                onClick={() => router.push('/student/login')}
                className="px-6 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all font-medium"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className="inline-flex gap-1 mb-3">
                <span className="w-2 h-2 bg-primary-600 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-primary-600 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-primary-600 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></span>
              </div>
              <p className="text-gray-700 font-medium">Completing login...</p>
            </div>
            <SkeletonCard />
          </div>
        )}
      </div>
    </div>
  );
}

