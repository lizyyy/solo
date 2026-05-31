import type { RecordStatus } from '../types';
import { STATUS_LABELS } from '../types';

interface StatusBadgeProps {
  status: RecordStatus;
  size?: 'sm' | 'md';
}

const statusClasses: Record<RecordStatus, string> = {
  normal: 'status-badge-normal',
  pending: 'status-badge-pending',
  corrected: 'status-badge-corrected',
  duplicate: 'status-badge-duplicate',
};

export const StatusBadge = ({ status, size = 'md' }: StatusBadgeProps) => {
  const sizeClasses = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-0.5';
  
  return (
    <span className={`status-badge ${statusClasses[status]} ${sizeClasses}`}>
      {STATUS_LABELS[status]}
    </span>
  );
};
