'use client';

import * as React from 'react';

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  max?: number;
  indicatorColor?: string;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ value = 0, max = 100, indicatorColor, size = 'md', showLabel = false, className = '', ...props }, ref) => {
    const percentage = Math.min(100, Math.max(0, Math.round(((value || 0) / max) * 100)));

    const heightClass = {
      sm: 'h-2',
      md: 'h-3',
      lg: 'h-4',
    }[size];

    return (
      <div className={`w-full flex items-center gap-2.5 ${className}`} ref={ref} {...props}>
        <div
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={max}
          className={`relative w-full ${heightClass} overflow-hidden rounded-none bg-subtle border border-main`}
        >
          <div
            className="h-full rounded-none transition-all duration-200 ease-out"
            style={{
              width: `${percentage}%`,
              backgroundColor: indicatorColor || '#10B981',
              boxShadow: percentage > 0 ? `0 0 10px ${indicatorColor || 'rgba(16, 185, 129, 0.4)'}` : 'none',
            }}
          />
        </div>
        {showLabel && (
          <span className="text-xs font-mono font-bold text-main min-w-[2.5rem] text-right">
            {percentage}%
          </span>
        )}
      </div>
    );
  }
);

Progress.displayName = 'Progress';
