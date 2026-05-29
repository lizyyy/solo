import { getStatusLabel, getStatusClass } from '@/utils/format';
import type { ApplicationStatus } from '@/types';

interface StatusBadgeProps {
  status: ApplicationStatus;
  showLabel?: boolean;
}

export default function StatusBadge({ status, showLabel = true }: StatusBadgeProps) {
  const className = getStatusClass(status);
  const label = getStatusLabel(status);

  return (
    <span className={className}>
      {showLabel && label}
    </span>
  );
}
