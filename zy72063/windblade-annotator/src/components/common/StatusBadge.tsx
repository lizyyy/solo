import { STATUS_LABELS, STATUS_COLORS } from '../../types';
import type { RecordStatus } from '../../types';

interface StatusBadgeProps {
  status: RecordStatus;
  className?: string;
}

export const StatusBadge = ({ status, className = '' }: StatusBadgeProps) => {
  const color = STATUS_COLORS[status];
  const label = STATUS_LABELS[status];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white ${color} ${className}`}
    >
      {label}
    </span>
  );
};
