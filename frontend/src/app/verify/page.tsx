/**
 * Hash verification portal - Cryptographic proof of evaluation integrity
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiClient, VerifyRequest, VerifyResponse } from '@/lib/api';
import {
  Shield, CheckCircle2, AlertTriangle, Lock, Unlock,
  Hash, Search, Link2, Info, ArrowLeft, Loader2,
  FileCheck, AlertCircle, ExternalLink, Copy, Check,
  Sparkles, ChevronRight, Calendar, Database
} from 'lucide-react';

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlId = searchParams.get('id');
  const urlHash = searchParams.get('hash');

  const [anonymizedId, setAnonymizedId] = useState(urlId || '');
  const [expectedHash, setExpectedHash] = useState(urlHash || '');
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);
  const [chainVerifyResult, setChainVerifyResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [chainLoading, setChainLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const verifyHash = async () => {
    if (!anonymizedId.trim() || !expectedHash.trim()) {
      setError('Please enter both Anonymized ID and Hash');
      return;
    }

    setLoading(true);
    setError(null);
    setVerifyResult(null);

    try {
      const requestData: VerifyRequest = {
        anonymized_id: anonymizedId.trim(),
        expected_hash: expectedHash.trim(),
      };

      const result = await apiClient.verifyHash(requestData);
      setVerifyResult(result);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const verifyChain = async () => {
    setChainLoading(true);
    setError(null);
    setChainVerifyResult(null);

    try {
      const result = await apiClient.verifyChain();
      setChainVerifyResult(result);
    } catch (err: any) {
      setError(err.message || 'Chain verification failed');
    } finally {
      setChainLoading(false);
    }
  };

  useEffect(() => {
    if (urlId && urlHash) {
      verifyHash();
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-white/20 backdrop-blur-sm border-2 border-white/30 mb-6 ring-4 ring-white/10">
              <Shield className="h-10 w-10 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 flex items-center justify-center gap-3">
              Verification Portal
              <Sparkles className="h-8 w-8 text-yellow-300" />
            </h1>
            <p className="text-xl text-white/90 max-w-3xl mx-auto leading-relaxed">
              Verify the integrity and authenticity of evaluation decisions using cryptographic hashes.
              Complete transparency through mathematical proof.
            </p>
            <button
              onClick={() => router.back()}
              className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 transition-all duration-200 font-medium text-sm hover:scale-105"
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content - Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Individual Hash Verification Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="bg-gradient-to-r from-primary-500 to-indigo-600 px-6 py-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Search className="h-5 w-5" />
                  Verify Individual Decision
                </h2>
                <p className="text-white/90 text-sm mt-1">Check a specific evaluation result</p>
              </div>

              <div className="p-6 space-y-5">
                {/* Anonymized ID Input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <Hash className="h-4 w-4 text-primary-600" />
                    Anonymized ID
                  </label>
                  <input
                    type="text"
                    value={anonymizedId}
                    onChange={(e) => setAnonymizedId(e.target.value)}
                    placeholder="ANON_1234567890_ABC123"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all font-mono text-sm"
                  />
                  <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Found in your evaluation results
                  </p>
                </div>

                {/* Expected Hash Input */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-primary-600" />
                    Expected Hash (SHA-256)
                  </label>
                  <textarea
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all font-mono text-xs resize-none"
                    rows={3}
                    value={expectedHash}
                    onChange={(e) => setExpectedHash(e.target.value)}
                    placeholder="Enter the 64-character SHA-256 hash from your results"
                  />
                  <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    64-character hexadecimal string
                  </p>
                </div>

                {/* Verify Button */}
                <button
                  onClick={verifyHash}
                  disabled={loading || !anonymizedId.trim() || !expectedHash.trim()}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all font-semibold shadow-md hover:shadow-lg disabled:bg-gray-300 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Shield className="h-5 w-5" />
                      Verify Hash
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5 flex items-start gap-3 shadow-md">
                <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-red-900 mb-1">Verification Error</h3>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            {/* Verification Result */}
            {verifyResult && (
              <div className={`rounded-2xl shadow-lg border-2 overflow-hidden ${
                verifyResult.is_valid
                  ? 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50'
                  : 'border-red-400 bg-gradient-to-br from-red-50 to-rose-50'
              }`}>
                <div className="p-8">
                  {/* Success State */}
                  {verifyResult.is_valid ? (
                    <div className="text-center mb-6">
                      <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-4 ring-8 ring-green-50">
                        <CheckCircle2 className="h-12 w-12 text-green-600" />
                      </div>
                      <h2 className="text-3xl md:text-4xl font-bold text-green-900 mb-3">
                        Verification Successful
                      </h2>
                      <p className="text-lg text-green-800 max-w-2xl mx-auto">
                        The decision data has <strong>NOT been tampered with</strong>. Hash matches perfectly.
                      </p>
                    </div>
                  ) : (
                    <div className="text-center mb-6">
                      <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-red-100 mb-4 ring-8 ring-red-50">
                        <AlertTriangle className="h-12 w-12 text-red-600" />
                      </div>
                      <h2 className="text-3xl md:text-4xl font-bold text-red-900 mb-3">
                        Verification Failed
                      </h2>
                      <p className="text-lg text-red-800 max-w-2xl mx-auto">
                        Hash mismatch detected. The decision data may have been modified.
                      </p>
                    </div>
                  )}

                  {/* Details Section */}
                  <div className="bg-white rounded-xl p-6 space-y-4 shadow-inner">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <Database className="h-5 w-5 text-primary-600" />
                        Verification Details
                      </h3>
                    </div>

                    {/* Anonymized ID */}
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Anonymized ID</p>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex items-center justify-between gap-2">
                        <p className="font-mono text-sm text-gray-900 break-all">{verifyResult.anonymized_id}</p>
                        <button
                          onClick={() => copyToClipboard(verifyResult.anonymized_id, 'id')}
                          className="flex-shrink-0 p-2 hover:bg-gray-200 rounded-lg transition-colors"
                          title="Copy to clipboard"
                        >
                          {copiedField === 'id' ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4 text-gray-600" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expected Hash */}
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Expected Hash</p>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex items-center justify-between gap-2">
                        <p className="font-mono text-xs text-gray-900 break-all flex-1">{verifyResult.expected_hash}</p>
                        <button
                          onClick={() => copyToClipboard(verifyResult.expected_hash, 'expected')}
                          className="flex-shrink-0 p-2 hover:bg-gray-200 rounded-lg transition-colors"
                          title="Copy to clipboard"
                        >
                          {copiedField === 'expected' ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4 text-gray-600" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Stored Hash */}
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Stored Hash</p>
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex items-center justify-between gap-2">
                        <p className="font-mono text-xs text-gray-900 break-all flex-1">{verifyResult.stored_hash}</p>
                        <button
                          onClick={() => copyToClipboard(verifyResult.stored_hash, 'stored')}
                          className="flex-shrink-0 p-2 hover:bg-gray-200 rounded-lg transition-colors"
                          title="Copy to clipboard"
                        >
                          {copiedField === 'stored' ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <Copy className="h-4 w-4 text-gray-600" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Explanation */}
                    {verifyResult.is_valid ? (
                      <div className="bg-green-50 border-2 border-green-200 p-4 rounded-xl">
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-green-900 mb-1">
                              What does this mean?
                            </p>
                            <p className="text-sm text-green-800">
                              This evaluation result is <strong>authentic and unaltered</strong> since creation.
                              The cryptographic hash provides mathematical proof of integrity. You can trust
                              that this decision has not been modified.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-red-50 border-2 border-red-200 p-4 rounded-xl">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-red-900 mb-2">
                              What does this mean?
                            </p>
                            <p className="text-sm text-red-800 mb-2">
                              The stored hash does not match the expected hash. This could indicate:
                            </p>
                            <ul className="text-sm text-red-800 space-y-1 list-disc list-inside ml-2">
                              <li>The decision data was modified after creation</li>
                              <li>You entered an incorrect hash or ID</li>
                              <li>There was an error in data storage</li>
                            </ul>
                            <p className="text-sm text-red-800 mt-3 font-medium">
                              Please contact support if you believe this is an error.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Chain Verification Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-300">
              <div className="bg-gradient-to-r from-purple-500 to-pink-600 px-6 py-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Link2 className="h-5 w-5" />
                  Verify Entire Hash Chain
                </h2>
                <p className="text-white/90 text-sm mt-1">Check integrity of all decisions</p>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-gray-700 leading-relaxed">
                  Verify the integrity of the complete decision chain. This checks that all decisions
                  are cryptographically linked and no tampering has occurred anywhere in the system.
                </p>

                <button
                  onClick={verifyChain}
                  disabled={chainLoading}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all font-semibold shadow-md hover:shadow-lg disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed"
                >
                  {chainLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Verifying Chain...
                    </>
                  ) : (
                    <>
                      <Link2 className="h-5 w-5" />
                      Verify Complete Chain
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Chain Verification Result */}
            {chainVerifyResult && (
              <div className={`rounded-2xl shadow-lg border-2 overflow-hidden ${
                chainVerifyResult.is_valid
                  ? 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50'
                  : 'border-red-400 bg-gradient-to-br from-red-50 to-rose-50'
              }`}>
                <div className="p-8">
                  {chainVerifyResult.is_valid ? (
                    <div className="text-center mb-6">
                      <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-4 ring-8 ring-green-50">
                        <Lock className="h-12 w-12 text-green-600" />
                      </div>
                      <h2 className="text-3xl md:text-4xl font-bold text-green-900 mb-3">
                        Chain is Valid
                      </h2>
                      <p className="text-lg text-green-800">
                        All <strong>{chainVerifyResult.chain_length}</strong> decisions in the chain are intact and unmodified.
                      </p>
                    </div>
                  ) : (
                    <div className="text-center mb-6">
                      <div className="inline-flex items-center justify-center h-20 w-20 rounded-full bg-red-100 mb-4 ring-8 ring-red-50">
                        <Unlock className="h-12 w-12 text-red-600" />
                      </div>
                      <h2 className="text-3xl md:text-4xl font-bold text-red-900 mb-3">
                        Chain Integrity Compromised
                      </h2>
                      <p className="text-lg text-red-800">
                        <strong>{chainVerifyResult.invalid_entries?.length || 0}</strong> invalid entries detected.
                      </p>
                    </div>
                  )}

                  <div className="bg-white rounded-xl p-6 space-y-5 shadow-inner">
                    {/* Chain Statistics */}
                    <div className="grid md:grid-cols-3 gap-4">
                      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-200">
                        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Total Entries</p>
                        <p className="text-3xl font-bold text-blue-900">{chainVerifyResult.chain_length}</p>
                      </div>
                      <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-200">
                        <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">First Entry</p>
                        <p className="text-sm font-mono text-purple-900 flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {chainVerifyResult.first_entry ? new Date(chainVerifyResult.first_entry).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                      <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200">
                        <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-1">Last Entry</p>
                        <p className="text-sm font-mono text-green-900 flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {chainVerifyResult.last_entry ? new Date(chainVerifyResult.last_entry).toLocaleDateString() : 'N/A'}
                        </p>
                      </div>
                    </div>

                    {/* Invalid Entries */}
                    {!chainVerifyResult.is_valid && chainVerifyResult.invalid_entries?.length > 0 && (
                      <div className="bg-red-50 border-2 border-red-200 p-4 rounded-xl">
                        <p className="text-sm font-semibold text-red-900 mb-3 flex items-center gap-2">
                          <AlertCircle className="h-5 w-5" />
                          Invalid Entries Detected:
                        </p>
                        <ul className="space-y-2">
                          {chainVerifyResult.invalid_entries.map((entry: any, index: number) => (
                            <li key={index} className="font-mono text-sm text-red-800 bg-red-100 p-2 rounded">
                              Index {entry.index}: {entry.chain_id}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Timestamp */}
                    <div className="pt-4 border-t border-gray-200">
                      <p className="text-xs text-gray-500 text-center flex items-center justify-center gap-2">
                        <Calendar className="h-3 w-3" />
                        Verified at: {new Date(chainVerifyResult.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Right Column */}
          <div className="space-y-6">
            {/* How It Works Card */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Info className="h-5 w-5 text-primary-600" />
                  How It Works
                </h3>

                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-r from-primary-50 to-indigo-50 rounded-lg border border-primary-200">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-primary-100 flex items-center justify-center">
                        <Hash className="h-5 w-5 text-primary-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1 text-sm">Cryptographic Hashing</h4>
                        <p className="text-xs text-gray-700 leading-relaxed">
                          Every decision is hashed using SHA-256, producing a unique 64-character
                          fingerprint. Any change produces a completely different hash.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                        <Link2 className="h-5 w-5 text-purple-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1 text-sm">Hash Chain</h4>
                        <p className="text-xs text-gray-700 leading-relaxed">
                          Each decision hash is linked to the previous one, creating an immutable chain.
                          Tampering breaks the entire chain.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-1 text-sm">Public Verification</h4>
                        <p className="text-xs text-gray-700 leading-relaxed">
                          Anyone can verify a decision's integrity without revealing applicant identities.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Why Important Card */}
            <div className="bg-gradient-to-br from-primary-600 to-indigo-700 rounded-2xl shadow-lg p-6 text-white">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-6 w-6" />
                <h3 className="font-bold text-lg">Why Is This Important?</h3>
              </div>
              <ul className="space-y-3 text-sm text-white/95">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">1</span>
                  <span>Ensures decisions cannot be secretly altered after creation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">2</span>
                  <span>Protects applicants from arbitrary changes</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">3</span>
                  <span>Provides mathematical proof of fairness and integrity</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0 h-5 w-5 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">4</span>
                  <span>Maintains complete transparency while preserving anonymity</span>
                </li>
              </ul>
            </div>

            {/* Quick Links */}
            <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Links</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => router.push('/student/dashboard')}
                    className="w-full flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg hover:from-blue-100 hover:to-cyan-100 transition-all group"
                  >
                    <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                      <ArrowLeft className="h-4 w-4 text-blue-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-gray-900 text-sm">Student Dashboard</p>
                    </div>
                  </button>

                  <button
                    onClick={() => router.push('/dashboard')}
                    className="w-full flex items-center gap-3 p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg hover:from-gray-100 hover:to-slate-100 transition-all group"
                  >
                    <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                      <ExternalLink className="h-4 w-4 text-gray-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-gray-900 text-sm">Public Dashboard</p>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading verification portal...</p>
        </div>
      </div>
    }>
      <VerifyContent />
    </Suspense>
  );
}
