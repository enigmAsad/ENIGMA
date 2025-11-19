'use client';

import React from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Check,
  CheckCircle2,
  Cpu,
  FileText,
  Lock,
  Package,
  Send,
  Sparkles,
  Target,
  Video,
} from 'lucide-react';

interface PhaseProgressProps {
  currentPhase: string;
  className?: string;
}

interface PhaseDefinition {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
}

// Phase definitions matching backend enum values (lowercase with underscores)
// Backend has 9 phases - interviews happen DURING the "scored" phase
const PHASES: PhaseDefinition[] = [
  { id: 'submission', name: 'Submission', description: 'Applications Open', icon: FileText },
  { id: 'frozen', name: 'Frozen', description: 'Data Locked', icon: Lock },
  { id: 'preprocessing', name: 'Preprocessing', description: 'Scrubbing PII + Metrics', icon: Sparkles },
  { id: 'batch_prep', name: 'Batch Prep', description: 'Export Ready', icon: Package },
  { id: 'processing', name: 'Processing', description: 'Phase 1 LLM Evaluation', icon: Cpu },
  { id: 'scored', name: 'Selection', description: 'Final Selection (2k selected)', icon: Target },
  { id: 'selection', name: 'Interviews', description: 'Phase 2 Interviews (k shortlisted)', icon: Video },
  { id: 'published', name: 'Published', description: 'Results Live', icon: Send },
  { id: 'completed', name: 'Completed', description: 'Cycle Closed', icon: CheckCircle2 },
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
            className="bg-primary-600 h-3 rounded-full transition-all duration-500 ease-out"
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
          const PhaseIcon = phase.icon;

          return (
            <div
              key={phase.id}
              className={`flex items-center p-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-primary-50 border border-primary-200'
                  : isCompleted
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-gray-50 border border-gray-200'
              }`}
            >
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg font-semibold ${
                isActive
                  ? 'bg-primary-600 text-white shadow-lg'
                  : isCompleted
                  ? 'bg-green-600 text-white shadow-md'
                  : 'bg-gray-300 text-gray-600'
              }`}>
                {isCompleted ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <PhaseIcon className="h-5 w-5" />
                )}
              </div>

              <div className="ml-4 flex-1">
                <div className={`font-semibold ${
                  isActive ? 'text-primary-900' : isCompleted ? 'text-green-900' : 'text-gray-700'
                }`}>
                  {phase.name}
                </div>
                <div className={`text-sm ${
                  isActive ? 'text-primary-700' : isCompleted ? 'text-green-700' : 'text-gray-500'
                }`}>
                  {phase.description}
                </div>
              </div>

              {isCurrent && (
                <div className="ml-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
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
