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
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <textarea
        className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${className}`}
        maxLength={maxLength}
        value={value}
        {...props}
      />
      <div className="flex justify-between items-center mt-1">
        <div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {helperText && !error && <p className="text-sm text-gray-500">{helperText}</p>}
        </div>
        {characterCount && maxLength && (
          <p className="text-sm text-gray-500">
            {currentLength} / {maxLength}
          </p>
        )}
      </div>
    </div>
  );
}
