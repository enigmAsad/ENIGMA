'use client';

import React, { useState } from 'react';
import { adminApiClient, type BatchStatus } from '@/lib/adminApi';

interface BatchManagementProps {
  cycleId: string;
  onImportSuccess?: () => void;
  className?: string;
}

export default function BatchManagement({ cycleId, onImportSuccess, className = '' }: BatchManagementProps) {
  const [batchId, setBatchId] = useState('');
  const [resultsFile, setResultsFile] = useState('');
  const [processing, setProcessing] = useState(false);
  const [batchStatus, setBatchStatus] = useState<BatchStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  const handleImportResults = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchId || !resultsFile) return;

    setProcessing(true);
    try {
      await adminApiClient.importLLMResults(parseInt(batchId), resultsFile);
      alert('LLM results imported successfully!');
      setBatchId('');
      setResultsFile('');
      onImportSuccess?.();
    } catch (error: any) {
      alert(error.message || 'Failed to import LLM results');
      console.error('Import error:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleCheckBatchStatus = async () => {
    if (!batchId) return;

    setLoadingStatus(true);
    try {
      const status = await adminApiClient.getBatchStatus(parseInt(batchId));
      setBatchStatus(status);
    } catch (error: any) {
      alert(error.message || 'Failed to get batch status');
      console.error('Status check error:', error);
    } finally {
      setLoadingStatus(false);
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Batch Management</h3>

      {/* Batch Status Check */}
      <div className="mb-6">
        <h4 className="text-md font-medium text-gray-900 mb-3">Check Batch Status</h4>
        <div className="flex gap-3">
          <input
            type="number"
            value={batchId}
            onChange={(e) => setBatchId(e.target.value)}
            placeholder="Batch ID"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
          <button
            onClick={handleCheckBatchStatus}
            disabled={!batchId || loadingStatus}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loadingStatus ? 'Checking...' : 'Check Status'}
          </button>
        </div>

        {batchStatus && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h5 className="font-medium text-gray-900 mb-2">Batch {batchStatus.batch_id} Status</h5>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Status</p>
                <p className="font-medium capitalize">{batchStatus.status}</p>
              </div>
              <div>
                <p className="text-gray-600">Progress</p>
                <p className="font-medium">{batchStatus.progress_percent.toFixed(1)}%</p>
              </div>
              <div>
                <p className="text-gray-600">Processed</p>
                <p className="font-medium">{batchStatus.processed_records} / {batchStatus.total_records}</p>
              </div>
              <div>
                <p className="text-gray-600">Failed</p>
                <p className="font-medium">{batchStatus.failed_records}</p>
              </div>
            </div>
            {batchStatus.error_log && (
              <div className="mt-3">
                <p className="text-gray-600 text-sm">Error Log:</p>
                <p className="text-red-600 text-sm font-mono bg-red-50 p-2 rounded mt-1">
                  {batchStatus.error_log}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Import LLM Results */}
      <div>
        <h4 className="text-md font-medium text-gray-900 mb-3">Import LLM Results</h4>
        <form onSubmit={handleImportResults} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Batch ID
            </label>
            <input
              type="number"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder="Enter batch ID"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Results File Path
            </label>
            <input
              type="text"
              value={resultsFile}
              onChange={(e) => setResultsFile(e.target.value)}
              placeholder="e.g., /path/to/results.jsonl"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <button
            type="submit"
            disabled={!batchId || !resultsFile || processing}
            className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {processing ? 'Importing...' : 'Import LLM Results'}
          </button>
        </form>
      </div>
    </div>
  );
}
