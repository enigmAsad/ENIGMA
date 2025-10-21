'use client';

import React, { useState, useEffect } from 'react';
import { ClipboardEdit, Loader2 } from 'lucide-react';

interface InterviewScoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (scoreData: {
    communication_score: number;
    critical_thinking_score: number;
    motivation_score: number;
    notes: string;
  }) => Promise<void>;
  isSaving: boolean;
}

const ScoreSlider = ({
  label,
  value,
  setter,
}: {
  label: string;
  value: number;
  setter: (value: number) => void;
}) => (
  <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 transition-all hover:border-slate-600">
    <div className="flex justify-between items-center mb-2">
      <label className="font-medium text-slate-300">{label}</label>
      <span className="font-bold text-lg text-white bg-slate-700/50 rounded-md px-2 py-0.5">
        {value.toFixed(1)}
      </span>
    </div>
    <input
      type="range"
      min="0"
      max="10"
      step="0.5"
      value={value}
      onChange={(e) => setter(parseFloat(e.target.value))}
      className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider-thumb"
    />
  </div>
);

const InterviewScoreModal: React.FC<InterviewScoreModalProps> = ({ isOpen, onClose, onSave, isSaving }) => {
  const [communicationScore, setCommunicationScore] = useState(5);
  const [criticalThinkingScore, setCriticalThinkingScore] = useState(5);
  const [motivationScore, setMotivationScore] = useState(5);
  const [notes, setNotes] = useState('');
  const [finalScore, setFinalScore] = useState(5.0);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setIsMounted(true), 50);
      return () => clearTimeout(timer);
    } else {
      setIsMounted(false);
    }
  }, [isOpen]);

  useEffect(() => {
    const avg = (communicationScore + criticalThinkingScore + motivationScore) / 3;
    setFinalScore(parseFloat(avg.toFixed(2)));
  }, [communicationScore, criticalThinkingScore, motivationScore]);

  const handleClose = () => {
    setIsMounted(false);
    setTimeout(onClose, 200);
  };

  const handleSave = () => {
    onSave({
      communication_score: communicationScore,
      critical_thinking_score: criticalThinkingScore,
      motivation_score: motivationScore,
      notes,
    }).then(() => {
      // Assuming onSave promise resolves on success
      handleClose();
    });
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 transition-opacity duration-200 ${
        isMounted ? 'opacity-100' : 'opacity-0'
      }`}
    >
      <div
        className={`bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-xl text-white overflow-hidden transform transition-all duration-200 ease-out ${
          isMounted ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        }`}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="bg-blue-500/10 p-2 rounded-lg border border-blue-500/20">
              <ClipboardEdit className="h-8 w-8 text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-100">Interview Feedback & Scoring</h2>
              <p className="mt-1 text-slate-400">
                Provide a score for the interview based on the following criteria. The final score is the average of all categories.
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 pt-0 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ScoreSlider label="Communication" value={communicationScore} setter={setCommunicationScore} />
            <ScoreSlider label="Critical Thinking" value={criticalThinkingScore} setter={setCriticalThinkingScore} />
            <ScoreSlider label="Motivation" value={motivationScore} setter={setMotivationScore} />
          </div>

          <div className="text-center bg-gradient-to-br from-slate-800 to-slate-900 p-6 rounded-xl border border-slate-700">
            <p className="text-slate-400 font-medium">Final Average Score</p>
            <p className="text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400 tracking-tighter">
              {finalScore.toFixed(2)}
            </p>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-slate-300 mb-1">
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="mt-1 block w-full rounded-md bg-slate-800 border-slate-600 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              placeholder="Enter any additional comments about the candidate..."
            />
          </div>
        </div>

        <div className="mt-2 p-6 bg-slate-900/60 border-t border-slate-700 flex justify-end space-x-4">
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="py-2 px-5 rounded-md text-slate-300 bg-transparent border border-slate-600 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center justify-center py-2 px-5 rounded-md text-white font-semibold bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save & Exit'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InterviewScoreModal;
