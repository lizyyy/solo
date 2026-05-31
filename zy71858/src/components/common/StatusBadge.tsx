import { RecordStatus } from '@/types';
import { getStatusLabel, getStatusColor } from '@/utils/statusUtils';

interface StatusBadgeProps {
  status: RecordStatus;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)} ${className}`}
    >
      {getStatusLabel(status)}
    </span>
  );
}
