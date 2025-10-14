
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { studentApiClient } from '@/lib/studentApi';

export default function GoogleCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const completeLogin = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const codeVerifier = sessionStorage.getItem('code_verifier');

      if (code && state && codeVerifier) {
        try {
          await studentApiClient.completeGoogleLogin(code, state, codeVerifier);
          sessionStorage.removeItem('code_verifier');
          router.push('/student/dashboard');
        } catch (err: any) {
          setError(err.message);
        }
      } else {
        setError('Missing code, state, or verifier from Google');
      }
    };

    completeLogin();
  }, [searchParams, router]);

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

