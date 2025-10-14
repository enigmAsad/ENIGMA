'use client';

import React from 'react';

interface PhaseProgressProps {
  currentPhase: string;
  className?: string;
}

const PHASES = [
  { id: 'submission', name: 'Submission', description: 'Applications Open' },
  { id: 'frozen', name: 'Frozen', description: 'Data Locked' },
  { id: 'preprocessing', name: 'Preprocessing', description: 'Computing Metrics' },
  { id: 'batch_prep', name: 'Batch Prep', description: 'Export Ready' },
  { id: 'processing', name: 'Processing', description: 'LLM Running' },
  { id: 'scored', name: 'Scored', description: 'Results Ready' },
  { id: 'selection', name: 'Selection', description: 'Top-K Selection' },
  { id: 'published', name: 'Published', description: 'Results Live' },
  { id: 'completed', name: 'Completed', description: 'Cycle Closed' },
];

export default function PhaseProgress({ currentPhase, className = '' }: PhaseProgressProps) {
  const getPhaseIndex = (phase: string) => {
    return PHASES.findIndex(p => p.id === phase);
  };

  const currentIndex = getPhaseIndex(currentPhase);
  const progressPercent = ((currentIndex + 1) / PHASES.length) * 100;

  return (
    <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Admission Cycle Progress</h3>
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Phase {currentIndex + 1} of {PHASES.length}</span>
          <span className="font-medium">{Math.round(progressPercent)}% Complete</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Phase Steps */}
      <div className="space-y-3">
        {PHASES.map((phase, index) => {
          const isActive = phase.id === currentPhase;
          const isCompleted = getPhaseIndex(phase.id) < currentIndex;
          const isCurrent = getPhaseIndex(phase.id) === currentIndex;

          return (
            <div
              key={phase.id}
              className={`flex items-center p-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-blue-50 border border-blue-200'
                  : isCompleted
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-gray-50 border border-gray-200'
              }`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : isCompleted
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-300 text-gray-600'
              }`}>
                {isCompleted ? '✓' : index + 1}
              </div>

              <div className="ml-4 flex-1">
                <div className={`font-medium ${
                  isActive ? 'text-blue-900' : isCompleted ? 'text-green-900' : 'text-gray-700'
                }`}>
                  {phase.name}
                </div>
                <div className={`text-sm ${
                  isActive ? 'text-blue-700' : isCompleted ? 'text-green-700' : 'text-gray-500'
                }`}>
                  {phase.description}
                </div>
              </div>

              {isCurrent && (
                <div className="ml-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    Current
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
