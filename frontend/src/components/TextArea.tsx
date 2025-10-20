/**
 * Reusable textarea component
 */

import { TextareaHTMLAttributes } from 'react';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  characterCount?: boolean;
}

export default function TextArea({
  label,
  error,
  helperText,
  characterCount = false,
  className = '',
  maxLength,
  value,
  ...props
}: TextAreaProps) {
  const currentLength = value ? String(value).length : 0;

  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm sm:text-base font-medium text-gray-700 mb-1.5 sm:mb-1">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        className={`w-full px-3 sm:px-4 py-2.5 sm:py-2 text-base border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-y min-h-[120px] ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${className}`}
        maxLength={maxLength}
        value={value}
        {...props}
      />
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mt-1.5 sm:mt-1 gap-1 sm:gap-0">
        <div className="flex-1">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {helperText && !error && <p className="text-xs sm:text-sm text-gray-500">{helperText}</p>}
        </div>
        {characterCount && maxLength && (
          <p className="text-xs sm:text-sm text-gray-500 font-mono">
            {currentLength} / {maxLength}
          </p>
        )}
      </div>
    </div>
  );
}
