'use client';

import React, { useState } from 'react';
import { Shield, Check, AlertTriangle, Loader2 } from 'lucide-react';

interface COIModalProps {
  isOpen: boolean;
  onAcceptAndStart: () => Promise<void>;
  isStarting: boolean;
}

const COIModal: React.FC<COIModalProps> = ({ isOpen, onAcceptAndStart, isStarting }) => {
  const [checkboxes, setCheckboxes] = useState({
    noIdentity: false,
    noConflict: false,
    willDisclose: false,
  });

  const allChecked = checkboxes.noIdentity && checkboxes.noConflict && checkboxes.willDisclose;

  const handleCheckboxChange = (checkbox: keyof typeof checkboxes) => {
    setCheckboxes(prev => ({ ...prev, [checkbox]: !prev[checkbox] }));
  };

  const handleAccept = async () => {
    if (allChecked && !isStarting) {
      await onAcceptAndStart();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop - non-dismissible */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-red-500 px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-white/20 backdrop-blur-sm border-2 border-white/30 flex items-center justify-center">
              <Shield className="h-8 w-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                Conflict of Interest Declaration
              </h2>
              <p className="text-white/90 text-sm mt-1">
                Anonymized Interview – Required Before Starting
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-8 py-6">
          <div className="mb-6">
            <div className="flex items-start gap-3 p-4 bg-amber-50 border-2 border-amber-200 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-900">
                <p className="font-semibold mb-1">Important Notice</p>
                <p>
                  This interview is conducted under strict anonymization protocols.
                  Please read and confirm each statement below before proceeding.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 mb-8">
            {/* Checkbox 1 */}
            <label className="flex items-start gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50/50 transition-all cursor-pointer group">
              <div className="relative flex items-center h-6">
                <input
                  type="checkbox"
                  checked={checkboxes.noIdentity}
                  onChange={() => handleCheckboxChange('noIdentity')}
                  disabled={isStarting}
                  className="h-6 w-6 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer disabled:opacity-50"
                />
                {checkboxes.noIdentity && (
                  <Check className="absolute h-4 w-4 text-white pointer-events-none left-1" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-gray-900 font-medium group-hover:text-primary-900">
                  I confirm that I <span className="font-bold">do not know the identity</span> of the student I am evaluating.
                </p>
              </div>
            </label>

            {/* Checkbox 2 */}
            <label className="flex items-start gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50/50 transition-all cursor-pointer group">
              <div className="relative flex items-center h-6">
                <input
                  type="checkbox"
                  checked={checkboxes.noConflict}
                  onChange={() => handleCheckboxChange('noConflict')}
                  disabled={isStarting}
                  className="h-6 w-6 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer disabled:opacity-50"
                />
                {checkboxes.noConflict && (
                  <Check className="absolute h-4 w-4 text-white pointer-events-none left-1" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-gray-900 font-medium group-hover:text-primary-900">
                  I currently have <span className="font-bold">no conflicts of interest</span> that would affect my evaluation.
                </p>
              </div>
            </label>

            {/* Checkbox 3 */}
            <label className="flex items-start gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-primary-300 hover:bg-primary-50/50 transition-all cursor-pointer group">
              <div className="relative flex items-center h-6">
                <input
                  type="checkbox"
                  checked={checkboxes.willDisclose}
                  onChange={() => handleCheckboxChange('willDisclose')}
                  disabled={isStarting}
                  className="h-6 w-6 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer disabled:opacity-50"
                />
                {checkboxes.willDisclose && (
                  <Check className="absolute h-4 w-4 text-white pointer-events-none left-1" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-gray-900 font-medium group-hover:text-primary-900">
                  If I become aware of any potential conflict during or after the interview (e.g., recognizing the student, prior professional interactions),
                  I will <span className="font-bold">immediately disclose it</span> to the committee.
                </p>
              </div>
            </label>
          </div>

          {/* Footer */}
          <div className="space-y-4">
            <button
              onClick={handleAccept}
              disabled={!allChecked || isStarting}
              className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl font-bold text-lg transition-all shadow-lg ${
                allChecked && !isStarting
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white hover:shadow-xl hover:scale-[1.02]'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isStarting ? (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  Starting Interview...
                </>
              ) : (
                <>
                  <Check className="h-6 w-6" />
                  Accept & Start Interview
                </>
              )}
            </button>

            {!allChecked && !isStarting && (
              <p className="text-center text-sm text-gray-600">
                Please confirm all statements above to proceed
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default COIModal;
