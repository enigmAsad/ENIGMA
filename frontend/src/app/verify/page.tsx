/**
 * Hash verification portal
 */

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Card from '@/components/Card';
import Input from '@/components/Input';
import Button from '@/components/Button';
import { apiClient, VerifyRequest, VerifyResponse } from '@/lib/api';

function VerifyContent() {
  const searchParams = useSearchParams();
  const urlId = searchParams.get('id');
  const urlHash = searchParams.get('hash');

  const [anonymizedId, setAnonymizedId] = useState(urlId || '');
  const [expectedHash, setExpectedHash] = useState(urlHash || '');
  const [verifyResult, setVerifyResult] = useState<VerifyResponse | null>(null);
  const [chainVerifyResult, setChainVerifyResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [chainLoading, setChainLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-4">Verification Portal</h1>
        <p className="text-lg text-gray-600">
          Verify the integrity of evaluation decisions using cryptographic hashes
        </p>
      </div>

      {/* Individual Hash Verification */}
      <Card title="Verify Individual Decision" subtitle="Check a specific evaluation result" className="mb-8">
        <div className="space-y-4">
          <Input
            label="Anonymized ID"
            type="text"
            value={anonymizedId}
            onChange={(e) => setAnonymizedId(e.target.value)}
            placeholder="ANON_1234567890_ABC123"
            helperText="Found in your evaluation results"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expected Hash (SHA-256)
            </label>
            <textarea
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all font-mono text-xs"
              rows={3}
              value={expectedHash}
              onChange={(e) => setExpectedHash(e.target.value)}
              placeholder="Enter the 64-character SHA-256 hash from your results"
            />
            <p className="mt-1 text-sm text-gray-500">64-character hexadecimal string</p>
          </div>

          <Button onClick={verifyHash} isLoading={loading} disabled={loading} className="w-full">
            Verify Hash
          </Button>
        </div>
      </Card>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Verification Result */}
      {verifyResult && (
        <Card className="mb-8">
          <div className="text-center">
            {verifyResult.is_valid ? (
              <>
                <div className="text-6xl mb-4">✅</div>
                <h2 className="text-3xl font-bold text-green-600 mb-4">Verification Successful</h2>
                <p className="text-lg text-gray-700 mb-6">
                  The decision data has NOT been tampered with. Hash matches perfectly.
                </p>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">⚠️</div>
                <h2 className="text-3xl font-bold text-red-600 mb-4">Verification Failed</h2>
                <p className="text-lg text-gray-700 mb-6">
                  Hash mismatch detected. The decision data may have been modified.
                </p>
              </>
            )}

            <div className="bg-gray-50 p-6 rounded-lg space-y-4 text-left">
              <div>
                <p className="text-sm text-gray-600 mb-1">Anonymized ID</p>
                <p className="font-mono text-sm bg-white p-2 rounded border">{verifyResult.anonymized_id}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Expected Hash</p>
                <p className="font-mono text-xs bg-white p-2 rounded border break-all">
                  {verifyResult.expected_hash}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-1">Stored Hash</p>
                <p className="font-mono text-xs bg-white p-2 rounded border break-all">
                  {verifyResult.stored_hash}
                </p>
              </div>

              {verifyResult.is_valid && (
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                  <p className="text-sm text-green-900">
                    <strong>What does this mean?</strong>
                  </p>
                  <p className="text-sm text-green-800 mt-1">
                    This evaluation result is authentic and has not been altered since creation.
                    The cryptographic hash provides mathematical proof of integrity.
                  </p>
                </div>
              )}

              {!verifyResult.is_valid && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                  <p className="text-sm text-red-900">
                    <strong>What does this mean?</strong>
                  </p>
                  <p className="text-sm text-red-800 mt-1">
                    The stored hash does not match the expected hash. This could indicate:
                  </p>
                  <ul className="text-sm text-red-800 mt-2 space-y-1 list-disc list-inside">
                    <li>The decision data was modified after creation</li>
                    <li>You entered an incorrect hash or ID</li>
                    <li>There was an error in data storage</li>
                  </ul>
                  <p className="text-sm text-red-800 mt-2">
                    Please contact support if you believe this is an error.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Chain Verification */}
      <Card title="Verify Entire Hash Chain" subtitle="Check integrity of all decisions" className="mb-8">
        <div className="space-y-4">
          <p className="text-gray-700">
            Verify the integrity of the complete decision chain. This checks that all decisions
            are cryptographically linked and no tampering has occurred anywhere in the system.
          </p>

          <Button onClick={verifyChain} isLoading={chainLoading} disabled={chainLoading} variant="secondary" className="w-full">
            Verify Complete Chain
          </Button>
        </div>
      </Card>

      {/* Chain Verification Result */}
      {chainVerifyResult && (
        <Card className="mb-8">
          <div className="text-center">
            {chainVerifyResult.is_valid ? (
              <>
                <div className="text-6xl mb-4">🔒</div>
                <h2 className="text-3xl font-bold text-green-600 mb-4">Chain is Valid</h2>
                <p className="text-lg text-gray-700 mb-6">
                  All {chainVerifyResult.chain_length} decisions in the chain are intact and unmodified.
                </p>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">🔓</div>
                <h2 className="text-3xl font-bold text-red-600 mb-4">Chain Integrity Compromised</h2>
                <p className="text-lg text-gray-700 mb-6">
                  {chainVerifyResult.invalid_entries?.length || 0} invalid entries detected in the chain.
                </p>
              </>
            )}

            <div className="bg-gray-50 p-6 rounded-lg space-y-4 text-left">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Total Entries</p>
                  <p className="text-2xl font-bold">{chainVerifyResult.chain_length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">First Entry</p>
                  <p className="text-sm font-mono">
                    {chainVerifyResult.first_entry ? new Date(chainVerifyResult.first_entry).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Last Entry</p>
                  <p className="text-sm font-mono">
                    {chainVerifyResult.last_entry ? new Date(chainVerifyResult.last_entry).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>

              {!chainVerifyResult.is_valid && chainVerifyResult.invalid_entries?.length > 0 && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                  <p className="text-sm text-red-900 font-semibold mb-2">Invalid Entries:</p>
                  <ul className="text-sm text-red-800 space-y-1">
                    {chainVerifyResult.invalid_entries.map((entry: any, index: number) => (
                      <li key={index} className="font-mono">
                        Index {entry.index}: {entry.chain_id}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-xs text-gray-500">
                Verified at: {new Date(chainVerifyResult.timestamp).toLocaleString()}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Info Section */}
      <Card title="How Hash Verification Works">
        <div className="space-y-4 text-gray-700">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">🔐 Cryptographic Hashing</h3>
            <p className="text-sm">
              Every evaluation decision is hashed using SHA-256, producing a unique 64-character
              fingerprint. Any change to the decision data, no matter how small, produces a
              completely different hash.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">🔗 Hash Chain</h3>
            <p className="text-sm">
              Each decision hash is linked to the previous one, creating an immutable chain.
              Tampering with any single decision breaks the entire chain, making modifications
              immediately detectable.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">✅ Public Verification</h3>
            <p className="text-sm">
              Anyone with an Anonymized ID and Hash can verify the integrity of a decision.
              This provides complete transparency and accountability without revealing
              applicant identities.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Why is this important?</strong>
            </p>
            <p className="text-sm text-blue-800 mt-1">
              Cryptographic verification ensures that once a decision is made, it cannot be
              secretly altered. This protects applicants from arbitrary changes and provides
              mathematical proof of fairness and integrity.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-4 py-8 text-center">Loading...</div>}>
      <VerifyContent />
    </Suspense>
  );
}
