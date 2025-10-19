'use client';

import React, { useState, useEffect } from 'react';

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

const InterviewScoreModal: React.FC<InterviewScoreModalProps> = ({ isOpen, onClose, onSave, isSaving }) => {
  const [communicationScore, setCommunicationScore] = useState(5);
  const [criticalThinkingScore, setCriticalThinkingScore] = useState(5);
  const [motivationScore, setMotivationScore] = useState(5);
  const [notes, setNotes] = useState('');
  const [finalScore, setFinalScore] = useState(5.0);

  useEffect(() => {
    const avg = (communicationScore + criticalThinkingScore + motivationScore) / 3;
    setFinalScore(parseFloat(avg.toFixed(2)));
  }, [communicationScore, criticalThinkingScore, motivationScore]);

  if (!isOpen) {
    return null;
  }

  const handleSave = () => {
    onSave({
      communication_score: communicationScore,
      critical_thinking_score: criticalThinkingScore,
      motivation_score: motivationScore,
      notes,
    });
  };

  const renderScoreInput = (
    label: string,
    value: number,
    setter: (value: number) => void
  ) => (
    <div>
      <label className="block text-sm font-medium text-gray-300">{label}</label>
      <div className="flex items-center gap-4 mt-1">
        <input
          type="range"
          min="0"
          max="10"
          step="0.5"
          value={value}
          onChange={(e) => setter(parseFloat(e.target.value))}
          className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer"
        />
        <span className="font-bold text-lg text-white w-12 text-center">{value.toFixed(1)}</span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg shadow-2xl p-8 w-full max-w-lg text-white">
        <h2 className="text-2xl font-bold mb-4">Submit Interview Score</h2>
        <p className="mb-6 text-gray-400">
          Optionally, please provide a score for the interview based on the following criteria.
          The final score will be the average of the three sub-scores.
        </p>

        <div className="space-y-6">
          {renderScoreInput('Communication Score', communicationScore, setCommunicationScore)}
          {renderScoreInput('Critical Thinking Score', criticalThinkingScore, setCriticalThinkingScore)}
          {renderScoreInput('Motivation Score', motivationScore, setMotivationScore)}

          <div className="text-center bg-gray-700 p-4 rounded-lg">
            <p className="text-gray-300">Final Average Score</p>
            <p className="text-3xl font-bold text-cyan-400">{finalScore.toFixed(2)}</p>
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-300">
              Notes (Optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white focus:ring-cyan-500 focus:border-cyan-500"
              placeholder="Enter any additional comments about the candidate..."
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end space-x-4">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="py-2 px-4 rounded-md text-gray-300 bg-gray-600 hover:bg-gray-500 transition-colors disabled:opacity-50"
          >
            Skip
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="py-2 px-4 rounded-md text-white bg-cyan-600 hover:bg-cyan-700 transition-colors disabled:bg-cyan-800 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Saving...' : 'Save Score and Exit'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InterviewScoreModal;
