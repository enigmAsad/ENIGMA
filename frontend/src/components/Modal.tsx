'use client';

import { useEffect } from 'react';
import { X, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';

export type ModalType = 'success' | 'error' | 'info' | 'warning';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  type?: ModalType;
  confirmText?: string;
  showCancel?: boolean;
  onConfirm?: () => void;
}

const modalStyles = {
  success: {
    gradient: 'from-green-600 to-emerald-700',
    iconBg: 'bg-green-100',
    icon: CheckCircle2,
    iconColor: 'text-green-600',
    buttonGradient: 'from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800',
  },
  error: {
    gradient: 'from-red-600 to-rose-700',
    iconBg: 'bg-red-100',
    icon: XCircle,
    iconColor: 'text-red-600',
    buttonGradient: 'from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800',
  },
  info: {
    gradient: 'from-blue-600 to-indigo-700',
    iconBg: 'bg-blue-100',
    icon: Info,
    iconColor: 'text-blue-600',
    buttonGradient: 'from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800',
  },
  warning: {
    gradient: 'from-yellow-500 to-orange-600',
    iconBg: 'bg-yellow-100',
    icon: AlertTriangle,
    iconColor: 'text-yellow-600',
    buttonGradient: 'from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700',
  },
};

export default function Modal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  confirmText = 'OK',
  showCancel = false,
  onConfirm,
}: ModalProps) {
  const style = modalStyles[type];
  const Icon = style.icon;

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

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

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-200 ease-out scale-100 opacity-100"
          style={{
            animation: 'modalFadeIn 0.2s ease-out'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <style jsx>{`
            @keyframes modalFadeIn {
              from {
                opacity: 0;
                transform: scale(0.95);
              }
              to {
                opacity: 1;
                transform: scale(1);
              }
            }
          `}</style>
          {/* Header with Gradient */}
          <div className={`bg-gradient-to-r ${style.gradient} px-6 py-5 relative`}>
            <div className="flex items-center gap-4">
              <div className={`${style.iconBg} p-3 rounded-xl shadow-lg`}>
                <Icon className={`h-7 w-7 ${style.iconColor}`} />
              </div>
              <h3 className="text-2xl font-bold text-white flex-1">{title}</h3>
              <button
                onClick={onClose}
                className="text-white/80 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
                aria-label="Close"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            <p className="text-gray-700 text-base leading-relaxed whitespace-pre-line">
              {message}
            </p>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex gap-3 justify-end">
            {showCancel && (
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all font-semibold shadow-sm hover:shadow"
              >
                Cancel
              </button>
            )}
            <button
              onClick={handleConfirm}
              className={`px-6 py-2.5 bg-gradient-to-r ${style.buttonGradient} text-white rounded-lg transition-all font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02]`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
