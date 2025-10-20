import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'rectangular' | 'circular' | 'text';
  width?: string;
  height?: string;
  animation?: 'pulse' | 'wave';
}

/**
 * Base Skeleton component for loading states
 * Provides smooth animated placeholders while content loads
 */
export function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
  animation = 'pulse',
}: SkeletonProps) {
  const variantClasses = {
    rectangular: 'rounded-md',
    circular: 'rounded-full',
    text: 'rounded',
  };

  const animationClasses = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
  };

  return (
    <div
      className={`bg-gray-200 ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={{ width, height }}
    />
  );
}

/**
 * Skeleton Card - For dashboard cards and content containers
 */
export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="space-y-4">
        {/* Title */}
        <Skeleton height="24px" width="60%" />

        {/* Subtitle or secondary text */}
        <Skeleton height="16px" width="40%" />

        {/* Main content area */}
        <div className="space-y-2 pt-2">
          <Skeleton height="20px" width="100%" />
          <Skeleton height="20px" width="90%" />
          <Skeleton height="20px" width="85%" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton Stats Card - For metric/statistic displays
 */
export function SkeletonStats({ count = 3, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="space-y-3">
            {/* Icon placeholder */}
            <Skeleton variant="circular" width="48px" height="48px" />

            {/* Value */}
            <Skeleton height="32px" width="50%" />

            {/* Label */}
            <Skeleton height="16px" width="70%" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton Table - For data tables (cycles, interviews, etc.)
 */
export function SkeletonTable({ rows = 5, columns = 5, className = '' }: { rows?: number; columns?: number; className?: string }) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden ${className}`}>
      {/* Table Header */}
      <div className="bg-gray-50 border-b border-gray-200 p-4">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }).map((_, index) => (
            <Skeleton key={index} height="20px" width="80%" />
          ))}
        </div>
      </div>

      {/* Table Rows */}
      <div className="divide-y divide-gray-200">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="p-4">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <Skeleton key={colIndex} height="16px" width={colIndex === 0 ? '90%' : '70%'} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton Form - For form loading states
 */
export function SkeletonForm({ fields = 5, className = '' }: { fields?: number; className?: string }) {
  return (
    <div className={`space-y-6 ${className}`}>
      {Array.from({ length: fields }).map((_, index) => (
        <div key={index} className="space-y-2">
          {/* Label */}
          <Skeleton height="16px" width="25%" />

          {/* Input field */}
          <Skeleton height="40px" width="100%" />

          {/* Helper text (occasional) */}
          {index % 2 === 0 && <Skeleton height="14px" width="40%" />}
        </div>
      ))}

      {/* Submit button */}
      <div className="pt-4">
        <Skeleton height="44px" width="150px" />
      </div>
    </div>
  );
}

/**
 * Skeleton Dashboard - Complete dashboard layout skeleton
 */
export function SkeletonDashboard({ className = '' }: { className?: string }) {
  return (
    <div className={`space-y-8 ${className}`}>
      {/* Header */}
      <div className="space-y-2">
        <Skeleton height="36px" width="300px" />
        <Skeleton height="20px" width="500px" />
      </div>

      {/* Stats Cards */}
      <SkeletonStats count={3} />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SkeletonCard />
        <SkeletonCard />
      </div>

      {/* Additional content */}
      <SkeletonCard />
    </div>
  );
}

/**
 * Skeleton List - For interview/application lists
 */
export function SkeletonList({ items = 4, className = '' }: { items?: number; className?: string }) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 space-y-3">
              {/* Title */}
              <Skeleton height="20px" width="40%" />

              {/* Metadata */}
              <div className="flex gap-4">
                <Skeleton height="16px" width="100px" />
                <Skeleton height="16px" width="120px" />
                <Skeleton height="16px" width="80px" />
              </div>
            </div>

            {/* Action button */}
            <Skeleton height="36px" width="100px" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton Button - For button loading states (inline)
 */
export function SkeletonButton({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <Skeleton variant="circular" width="16px" height="16px" />
      <Skeleton height="16px" width="60px" />
    </div>
  );
}
