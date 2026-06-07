import { ReviewStatus, STATUS_LABELS, STATUS_COLORS } from '@/types';
import { clsx } from 'clsx';

interface StatusBadgeProps {
  status: ReviewStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={clsx('badge', STATUS_COLORS[status], className)}>
      {STATUS_LABELS[status]}
    </span>
  );
}
