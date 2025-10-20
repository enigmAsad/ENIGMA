'use client';

import { useEffect } from 'react';
import { CheckCircle2, Loader2, Circle, XCircle, Sparkles } from 'lucide-react';

export interface PipelineStep {
  key: string;
  label: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  errorMessage?: string;
}

interface PipelineProgressModalProps {
  isOpen: boolean;
  steps: PipelineStep[];
  onClose?: () => void;
  canClose?: boolean;
}

export default function PipelineProgressModal({
  isOpen,
  steps,
  onClose,
  canClose = false,
}: PipelineProgressModalProps) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const currentStepIndex = steps.findIndex(s => s.status === 'running');
  const completedCount = steps.filter(s => s.status === 'completed').length;
  const hasError = steps.some(s => s.status === 'error');
  const isComplete = completedCount === steps.length && !hasError;
  const progress = (completedCount / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={canClose ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header with Gradient */}
          <div className="bg-gradient-to-r from-primary-600 via-indigo-600 to-purple-700 px-8 py-6 relative overflow-hidden">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS1vcGFjaXR5PSIwLjEiIHN0cm9rZS13aWR0aD0iMSIvPjwvcGF0dGVybj48L2RlZnM+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0idXJsKCNncmlkKSIvPjwvc3ZnPg==')] opacity-20" />

            <div className="relative flex items-center gap-4">
              <div className="p-3 bg-white/20 backdrop-blur-sm rounded-xl shadow-lg border border-white/30">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-white">Processing Pipeline</h3>
                <p className="text-primary-100 text-sm mt-1">
                  {hasError ? 'Pipeline encountered an error' : isComplete ? 'Pipeline completed successfully!' : 'Automated workflow in progress...'}
                </p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-6 relative">
              <div className="flex justify-between text-xs text-white/90 mb-2">
                <span className="font-semibold">{completedCount} of {steps.length} steps completed</span>
                <span className="font-semibold">{Math.round(progress)}%</span>
              </div>
              <div className="h-2.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
                <div
                  className={`h-full transition-all duration-500 ease-out rounded-full ${
                    hasError
                      ? 'bg-gradient-to-r from-red-500 to-red-600'
                      : isComplete
                      ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                      : 'bg-gradient-to-r from-blue-400 to-cyan-500'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Steps List */}
          <div className="px-8 py-6 max-h-[60vh] overflow-y-auto">
            <div className="space-y-4">
              {steps.map((step, index) => {
                const isActive = step.status === 'running';
                const isCompleted = step.status === 'completed';
                const isError = step.status === 'error';
                const isPending = step.status === 'pending';

                return (
                  <div
                    key={step.key}
                    className={`relative flex gap-4 p-4 rounded-xl border-2 transition-all duration-300 ${
                      isActive
                        ? 'bg-blue-50 border-blue-400 shadow-lg scale-[1.02]'
                        : isCompleted
                        ? 'bg-green-50 border-green-400'
                        : isError
                        ? 'bg-red-50 border-red-400'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    {/* Step Number Badge */}
                    <div className="flex-shrink-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-md ${
                          isActive
                            ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
                            : isCompleted
                            ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
                            : isError
                            ? 'bg-gradient-to-br from-red-500 to-rose-600 text-white'
                            : 'bg-white text-gray-400 border-2 border-gray-300'
                        }`}
                      >
                        {isCompleted ? (
                          <CheckCircle2 className="h-6 w-6" />
                        ) : isActive ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : isError ? (
                          <XCircle className="h-6 w-6" />
                        ) : (
                          <Circle className="h-5 w-5" />
                        )}
                      </div>
                    </div>

                    {/* Step Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4
                          className={`font-bold text-base ${
                            isActive
                              ? 'text-blue-900'
                              : isCompleted
                              ? 'text-green-900'
                              : isError
                              ? 'text-red-900'
                              : 'text-gray-500'
                          }`}
                        >
                          {step.label}
                        </h4>

                        {/* Status Badge */}
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0 ${
                            isActive
                              ? 'bg-blue-100 text-blue-700 border border-blue-300'
                              : isCompleted
                              ? 'bg-green-100 text-green-700 border border-green-300'
                              : isError
                              ? 'bg-red-100 text-red-700 border border-red-300'
                              : 'bg-gray-100 text-gray-500 border border-gray-300'
                          }`}
                        >
                          {isActive ? 'In Progress...' : isCompleted ? 'Complete' : isError ? 'Failed' : 'Pending'}
                        </span>
                      </div>

                      <p
                        className={`text-sm mt-1 ${
                          isActive ? 'text-blue-700' : isCompleted ? 'text-green-700' : isError ? 'text-red-700' : 'text-gray-500'
                        }`}
                      >
                        {isError && step.errorMessage ? step.errorMessage : step.description}
                      </p>

                      {/* Active step animation */}
                      {isActive && (
                        <div className="mt-3">
                          <div className="flex items-center gap-2 text-xs text-blue-600">
                            <div className="flex gap-1">
                              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                              <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                            </div>
                            <span className="font-medium">Processing...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer */}
          {(isComplete || hasError || canClose) && (
            <div className="px-8 py-5 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={onClose}
                className={`px-6 py-2.5 rounded-lg font-semibold shadow-lg transition-all transform hover:scale-[1.02] ${
                  isComplete
                    ? 'bg-gradient-to-r from-green-600 to-emerald-700 text-white hover:from-green-700 hover:to-emerald-800'
                    : hasError
                    ? 'bg-gradient-to-r from-red-600 to-rose-700 text-white hover:from-red-700 hover:to-rose-800'
                    : 'bg-gradient-to-r from-gray-600 to-gray-700 text-white hover:from-gray-700 hover:to-gray-800'
                }`}
              >
                {isComplete ? 'Continue' : hasError ? 'Close' : 'Cancel'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
