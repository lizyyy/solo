import { ProcessingStatus } from '@/types';
import { getStatusDisplayName, getStatusColor } from '@/utils/stateMachine';

interface StatusBadgeProps {
  status: ProcessingStatus;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const colorClass = getStatusColor(status);
  const displayName = getStatusDisplayName(status);

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium border ${colorClass} ${className}`}
    >
      {displayName}
    </span>
  );
}
