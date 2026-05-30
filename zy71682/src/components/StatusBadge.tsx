import { RequirementStatus } from '@/types';
import { getStatusLabel } from '@/utils/helpers';

interface StatusBadgeProps {
  status: RequirementStatus;
  showLabel?: boolean;
  className?: string;
}

export function StatusBadge({ status, showLabel = true, className = '' }: StatusBadgeProps) {
  const statusClass = {
    [RequirementStatus.NORMAL]: 'status-normal',
    [RequirementStatus.PENDING]: 'status-pending',
    [RequirementStatus.CONFLICT]: 'status-conflict'
  }[status];

  const dotColor = {
    [RequirementStatus.NORMAL]: 'bg-neon-green',
    [RequirementStatus.PENDING]: 'bg-neon-orange',
    [RequirementStatus.CONFLICT]: 'bg-neon-red'
  }[status];

  return (
    <span className={`status-badge ${statusClass} inline-flex items-center gap-1 ${className}`}>
      <span className={`w-2 h-2 rounded-full ${dotColor} ${status !== RequirementStatus.NORMAL ? 'animate-pulse' : ''}`} />
      {showLabel && getStatusLabel(status)}
    </span>
  );
}
