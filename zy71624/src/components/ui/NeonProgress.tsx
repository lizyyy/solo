import { cn } from '@/lib/utils';

type NeonProgressVariant = 'purple' | 'cyan' | 'green' | 'red' | 'orange';

interface NeonProgressProps {
  value: number;
  max?: number;
  variant?: NeonProgressVariant;
  showLabel?: boolean;
  label?: string;
  className?: string;
}

const variantColors: Record<NeonProgressVariant, string> = {
  purple: 'bg-neon-purple',
  cyan: 'bg-neon-cyan',
  green: 'bg-neon-green',
  red: 'bg-neon-red',
  orange: 'bg-neon-orange',
};

const variantShadows: Record<NeonProgressVariant, string> = {
  purple: 'shadow-neon-purple',
  cyan: 'shadow-neon-cyan',
  green: 'shadow-neon-green',
  red: 'shadow-neon-red',
  orange: 'shadow-neon-orange',
};

export function NeonProgress({
  value,
  max = 100,
  variant = 'purple',
  showLabel = false,
  label,
  className,
}: NeonProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const isLow = percentage < 20;

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex justify-between mb-1 text-xs">
          <span className="text-neon-silver">{label || '进度'}</span>
          <span className={cn(isLow ? 'text-neon-red animate-flicker' : 'text-neon-purple')}>
            {Math.round(percentage)}%
          </span>
        </div>
      )}
      <div className="h-2 bg-neon-bgSecondary rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            variantColors[variant],
            variantShadows[variant],
            isLow && 'animate-flicker'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
