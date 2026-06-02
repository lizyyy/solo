import type { RecordStatus } from '@/types';
import { STATUS_LABELS, STATUS_COLORS } from '@/types';

interface StatusBadgeProps {
  status: RecordStatus;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return (
    <span className={`status-badge ${STATUS_COLORS[status]} ${className}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
