import React from 'react';

interface ProgressBarProps {
  progress: number;
  label?: string;
  showPercent?: boolean;
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'success' | 'warning' | 'danger';
  animated?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  label,
  showPercent = true,
  size = 'md',
  color = 'primary',
  animated = true
}) => {
  const heightClasses = {
    sm: 'h-1.5',
    md: 'h-2.5',
    lg: 'h-4'
  }[size];
  
  const colorClasses = {
    primary: 'bg-primary-500',
    success: 'bg-success-500',
    warning: 'bg-warning-500',
    danger: 'bg-danger-500'
  }[color];
  
  const clampedProgress = Math.min(100, Math.max(0, progress));
  const animatedClass = animated ? 'transition-all duration-500 ease-out' : '';
  
  return (
    <div className="w-full">
      {(label || showPercent) && (
        <div className="flex justify-between items-center mb-1.5">
          {label && <span className="text-sm font-medium text-gray-700">{label}</span>}
          {showPercent && (
            <span className="text-sm font-medium text-gray-500 font-mono">{clampedProgress.toFixed(0)}%</span>
          )}
        </div>
      )}
      <div className={`w-full bg-gray-100 rounded-full overflow-hidden ${heightClasses}`}>
        <div
          className={`h-full rounded-full ${colorClasses} ${animatedClass}`}
          style={{ width: `${clampedProgress}%` }}
        >
          {size === 'lg' && (
            <div className="h-full w-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
          )}
        </div>
      </div>
    </div>
  );
};

interface StepProgressProps {
  steps: { label: string; description?: string }[];
  currentStep: number;
  completedSteps?: number[];
}

export const StepProgress: React.FC<StepProgressProps> = ({
  steps,
  currentStep,
  completedSteps = []
}) => {
  return (
    <div className="flex items-center justify-between w-full">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(index) || index < currentStep;
        const isCurrent = index === currentStep;
        const isPending = !isCompleted && !isCurrent;
        
        return (
          <React.Fragment key={index}>
            <div className="flex flex-col items-center min-w-0 flex-1">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full border-2 font-semibold text-sm transition-colors duration-300 ${
                  isCompleted
                    ? 'bg-success-500 border-success-500 text-white'
                    : isCurrent
                    ? 'bg-primary-500 border-primary-500 text-white'
                    : 'bg-white border-gray-300 text-gray-400'
                }`}
              >
                {isCompleted ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <div className="mt-2 text-center">
                <p className={`text-xs font-medium ${isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-400'}`}>
                  {step.label}
                </p>
                {step.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{step.description}</p>
                )}
              </div>
            </div>
            {index < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 rounded-full ${isCompleted ? 'bg-success-500' : 'bg-gray-200'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
