import React from 'react';

interface ProgressBarProps {
  progress: number;
  showLabel?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  height?: 'sm' | 'md' | 'lg';
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  showLabel = true,
  variant = 'default',
  height = 'md'
}) => {
  const heightClass = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3'
  }[height];

  const variantClass = {
    default: 'bg-primary-600',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    danger: 'bg-danger-500',
    info: 'bg-info-500'
  }[variant];

  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="w-full">
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-xs text-primary-500 font-mono">进度</span>
          <span className="text-xs font-mono font-medium text-primary-700">{clampedProgress}%</span>
        </div>
      )}
      <div className={`w-full bg-primary-100 ${heightClass} overflow-hidden`}>
        <div
          className={`${heightClass} ${variantClass} transition-all duration-300 ease-out`}
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};
