import { STATUS_LABELS, STATUS_COLORS } from '../../types';
import type { BubbleStatus } from '../../types';

interface StatusBadgeProps {
  status: BubbleStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1';
  return (
    <span
      className={`inline-flex items-center rounded border font-medium ${STATUS_COLORS[status]} ${sizeClasses}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
