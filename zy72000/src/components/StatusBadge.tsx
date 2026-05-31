import type { RedemptionStatus } from '@/types';
import { STATUS_CLASSES, STATUS_LABELS } from '@/data/constants';

interface StatusBadgeProps {
  status: RedemptionStatus;
  showLabel?: boolean;
}

export default function StatusBadge({ status, showLabel = true }: StatusBadgeProps) {
  const badgeClass = STATUS_CLASSES[status];
  const label = STATUS_LABELS[status];

  return (
    <span className={badgeClass}>
      {showLabel ? label : ''}
    </span>
  );
}
