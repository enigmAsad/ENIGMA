"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { adminApiClient } from '@/lib/adminApi';
import { Mail, Lock, ShieldCheck, Check, Loader2 } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await adminApiClient.login(username, password);
      router.push('/admin/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

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
            Admin Control Panel
          </div>
          <h1 className="text-4xl font-extrabold mb-4 leading-tight">Welcome to ENIGMA Admin</h1>
          <p className="text-white/90 mb-8 max-w-md">Securely manage the admissions process with powerful tools and visibility.</p>
          <div className="space-y-3">
            <div className="flex items-center text-white/95">
              <span className="bg-white/20 p-2 rounded-full mr-3 border border-white/30"><Check className="h-4 w-4" /></span>
              <p>Manage cycles and applications</p>
            </div>
            <div className="flex items-center text-white/95">
              <span className="bg-white/20 p-2 rounded-full mr-3 border border-white/30"><Check className="h-4 w-4" /></span>
              <p>Monitor processing and results</p>
            </div>
            <div className="flex items-center text-white/95">
              <span className="bg-white/20 p-2 rounded-full mr-3 border border-white/30"><Check className="h-4 w-4" /></span>
              <p>Hardened access with secure auth</p>
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
            <h2 className="mt-4 text-3xl font-bold text-gray-900">Admin Login</h2>
            <p className="mt-2 text-gray-600">Secure access to the admin control panel</p>
          </div>

          <div className="bg-white rounded-xl shadow-xl overflow-hidden border border-gray-100">
            <div className="p-6 sm:p-8">
              {error && (
                <div className="mb-6 rounded-lg bg-red-50 p-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Username
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                      <Mail className="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </div>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      className="block w-full rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-primary-500 pl-10 pr-3 py-2.5 placeholder-gray-400 shadow-sm focus:outline-none sm:text-sm bg-white text-gray-900"
                      placeholder="Enter your username"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 pl-3 flex items-center">
                      <Lock className="h-5 w-5 text-gray-400" aria-hidden="true" />
                    </div>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="block w-full rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-primary-500 pl-10 pr-3 py-2.5 placeholder-gray-400 shadow-sm focus:outline-none sm:text-sm bg-white text-gray-900"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="relative flex w-full justify-center rounded-lg border border-transparent bg-primary-600 py-3 px-4 text-sm font-medium text-white shadow-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading && (
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                        <Loader2 className="h-5 w-5 animate-spin text-white/80" />
                      </span>
                    )}
                    <span className="flex items-center justify-center">
                      {loading ? 'Signing in...' : 'Sign In'}
                    </span>
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="mt-6 text-center">
            <a href="/" className="text-sm font-medium text-primary-600 hover:text-primary-700">← Back to Home</a>
          </div>

          <p className="mt-6 text-center text-xs text-gray-600">
            This is a restricted area. Unauthorized access attempts are monitored and logged.
          </p>
        </div>
      </div>
    </div>
  );
}
