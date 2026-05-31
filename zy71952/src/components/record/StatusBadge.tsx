import type { RecordStatus } from '../../types';
import { statusConfig, cn } from '../../utils/status';

interface StatusBadgeProps {
  status: RecordStatus;
  showDot?: boolean;
  className?: string;
}

export function StatusBadge({ status, showDot = true, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium border',
        config.bgColor,
        config.color,
        config.borderColor,
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            'w-2 h-2 rounded-full transition-transform duration-150 hover:scale-125',
            status === 'confirmed' && 'bg-status-confirmed',
            status === 'pending' && 'bg-status-pending',
            status === 'modified' && 'bg-status-modified'
          )}
        />
      )}
      {config.label}
    </span>
  );
}
