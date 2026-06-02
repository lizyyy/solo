import { PointStatus, pointStatusLabels } from '@/types';
import { cn } from '@/utils/cn';

interface StatusBadgeProps {
  status: PointStatus;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const badgeClass = {
    [PointStatus.CONFIRMED]: 'badge-success',
    [PointStatus.PENDING]: 'badge-warning',
    [PointStatus.CONFLICT]: 'badge-danger',
    [PointStatus.MERGED]: 'badge-pending',
  }[status];

  return (
    <span className={cn(badgeClass, className)}>
      {pointStatusLabels[status]}
    </span>
  );
}
