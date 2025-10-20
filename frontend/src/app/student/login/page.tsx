
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useStudentAuth';
import { SkeletonCard } from '@/components/Skeleton';
import { Check, ShieldCheck } from 'lucide-react';

export default function StudentLoginPage() {
  const { student, login, loading, error } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (student) {
      router.push('/student/dashboard');
    }
  }, [student, router]);

  if (loading || student) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="max-w-md mx-auto px-4 py-12">
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-primary-50 to-primary-100">
      {/* Left decorative panel (desktop) */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600 to-primary-700" />

        {/* Light accents */}
        <div className="absolute top-8 right-16 w-56 h-56 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-16 left-10 w-72 h-72 bg-white/10 rounded-full blur-3xl" />

        {/* Repeated logo pattern */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -left-6 top-24 w-40 h-40 opacity-70 rotate-12">
            <img src="/images/eNigma-logo.png" alt="eNigma" className="w-full h-full object-contain" />
          </div>
          <div className="absolute right-14 top-10 w-36 h-36 opacity-60 -rotate-12">
            <img src="/images/eNigma-logo.png" alt="eNigma" className="w-full h-full object-contain" />
          </div>
          <div className="absolute left-1/3 bottom-24 w-44 h-44 opacity-80 rotate-45">
            <img src="/images/eNigma-logo.png" alt="eNigma" className="w-full h-full object-contain" />
          </div>
          <div className="absolute right-1/4 top-2/3 w-28 h-28 opacity-60">
            <img src="/images/eNigma-logo.png" alt="eNigma" className="w-full h-full object-contain" />
          </div>
        </div>

        <div className="relative z-10 flex flex-col justify-center items-start h-full px-12 text-white">
          <div className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-white/20 backdrop-blur-sm mb-6">
            <ShieldCheck className="w-4 h-4 mr-2" />
            ENIGMA Admissions
          </div>
          <h1 className="text-4xl font-extrabold mb-4 leading-tight">Welcome to ENIGMA</h1>
          <p className="text-white/90 mb-8 max-w-md">Apply and track your admission journey with a secure student portal.</p>
          <div className="space-y-3">
            <div className="flex items-center text-white/95">
              <span className="bg-white/20 p-2 rounded-full mr-3 border border-white/30"><Check className="h-4 w-4" /></span>
              <p>Start your application quickly</p>
            </div>
            <div className="flex items-center text-white/95">
              <span className="bg-white/20 p-2 rounded-full mr-3 border border-white/30"><Check className="h-4 w-4" /></span>
              <p>Track status in real-time</p>
            </div>
            <div className="flex items-center text-white/95">
              <span className="bg-white/20 p-2 rounded-full mr-3 border border-white/30"><Check className="h-4 w-4" /></span>
              <p>Secure sign-in with Google</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right content: form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="h-16 w-16 rounded-full bg-gradient-to-r from-primary-600 to-primary-700 flex items-center justify-center mx-auto shadow-lg">
              <img src="/images/eNigma-logo.png" alt="eNigma Logo" className="w-10 h-10 object-contain" />
            </div>
          <h2 className="mt-4 text-3xl font-bold text-gray-900">Student Login</h2>
          <p className="mt-2 text-gray-600">Sign in to continue your application</p>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-200">
            <div className="p-6 sm:p-8">
              {error && (
                <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3">
                  <div className="flex-shrink-0 h-5 w-5 rounded-full bg-red-100 flex items-center justify-center">
                    <span className="text-red-600 text-xs font-bold">!</span>
                  </div>
                  <p className="text-sm text-red-700 flex-1">{error}</p>
                </div>
              )}

              <div className="space-y-4">
                <button
                  onClick={login}
                  className="group relative flex w-full items-center justify-center rounded-lg border-2 border-gray-300 bg-white py-3.5 px-4 text-sm font-semibold text-gray-900 shadow-md hover:shadow-lg hover:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-200 hover:scale-[1.02]"
                >
                  <span className="absolute inset-y-0 left-0 flex items-center pl-5">
                    <svg className="h-5 w-5 group-hover:scale-110 transition-transform" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                      <path fill="#EA4335" d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.37-2.37C13.7.64 11.53 0 9 0 5.48 0 2.44 2.01.96 4.95l2.89 2.24C4.52 5.14 6.59 3.48 9 3.48z"/>
                      <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.18-1.84H9v3.48h4.84c-.21 1.12-.84 2.07-1.79 2.71l2.73 2.12c1.6-1.47 2.86-3.64 2.86-6.47z"/>
                      <path fill="#FBBC05" d="M3.85 10.73a5.52 5.52 0 010-3.47L.96 5.02a9 9 0 000 7.96l2.89-2.25z"/>
                      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.73-2.12c-.76.51-1.74.81-3.23.81-2.41 0-4.48-1.64-5.21-3.86L.96 12.98C2.44 15.99 5.48 18 9 18z"/>
                    </svg>
                  </span>
                  <span className="flex items-center justify-center">Continue with Google</span>
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-white text-gray-500 font-medium">SECURE AUTHENTICATION</span>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-blue-900 mb-1">Secure OAuth 2.0</p>
                      <p className="text-xs text-blue-700">Your credentials are never stored on our servers. We use Google's secure authentication.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <a href="/" className="text-sm font-medium text-primary-600 hover:text-primary-700">← Back to Home</a>
          </div>

          <p className="mt-6 text-center text-xs text-gray-600">
            Use your Google account to sign in securely.
          </p>
        </div>
      </div>
    </div>
  );
}
