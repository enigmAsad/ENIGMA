/**
 * Reusable card component
 */

import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
}

export default function Card({ children, className = '', title, subtitle }: CardProps) {
  return (
    <div className={`bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden ${className}`}>
      {(title || subtitle) && (
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 bg-gray-50">
          {title && <h3 className="text-lg sm:text-xl font-semibold text-gray-900">{title}</h3>}
          {subtitle && <p className="text-xs sm:text-sm text-gray-600 mt-1">{subtitle}</p>}
        </div>
      )}
      <div className="p-4 sm:p-6">{children}</div>
    </div>
  );
}
