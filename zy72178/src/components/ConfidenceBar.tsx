import { cn } from '../lib/utils';

interface ConfidenceBarProps {
  confidence: number;
  threshold: number;
  showLabels?: boolean;
  size?: 'sm' | 'md';
}

export function ConfidenceBar({
  confidence,
  threshold,
  showLabels = true,
  size = 'md',
}: ConfidenceBarProps) {
  const percentage = Math.min(100, Math.max(0, confidence * 100));
  const thresholdPercentage = threshold * 100;
  const isAboveThreshold = confidence >= threshold;

  const heightClass = size === 'sm' ? 'h-1.5' : 'h-2.5';

  return (
    <div className="w-full">
      <div className={cn(
        'relative w-full rounded-full bg-slate-200 overflow-hidden',
        heightClass
      )}>
        <div
          className={cn(
            'absolute left-0 top-0 h-full rounded-full transition-all duration-500',
            isAboveThreshold
              ? 'bg-gradient-to-r from-accent-emerald-400 to-accent-emerald-500'
              : 'bg-gradient-to-r from-accent-amber-400 to-accent-amber-500'
          )}
          style={{ width: `${percentage}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white shadow-md z-10"
          style={{ left: `${thresholdPercentage}%` }}
          title={`阈值: ${threshold}`}
        />
      </div>
      {showLabels && (
        <div className="flex justify-between items-center mt-1 text-xs">
          <span className={cn(
            'font-medium',
            isAboveThreshold ? 'text-accent-emerald-600' : 'text-accent-amber-600'
          )}>
            置信度: {percentage.toFixed(1)}%
          </span>
          <span className="text-slate-500">
            阈值: {thresholdPercentage}%
          </span>
        </div>
      )}
    </div>
  );
}
