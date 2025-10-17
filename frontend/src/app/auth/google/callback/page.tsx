
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { studentApiClient } from '@/lib/studentApi';
import { useAuth } from '@/hooks/useStudentAuth';

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
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="p-8 bg-white rounded-lg shadow-md">
        {error ? (
          <p className="text-red-500">{error}</p>
        ) : (
          <p>Completing login...</p>
        )}
      </div>
    </div>
  );
}

