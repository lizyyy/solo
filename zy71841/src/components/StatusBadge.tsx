import { statusLabels } from '@/types';
import type { RecordStatus } from '@/types';
import { getStatusBgClass } from '@/utils/helpers';

interface StatusBadgeProps {
  status: RecordStatus;
  className?: string;
}

export default function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return (
    <span className={`badge ${getStatusBgClass(status)} ${className}`}>
      {statusLabels[status]}
    </span>
  );
}
