import type { ApplicationStatus } from '../types';
import { STATUS_LABELS, STATUS_COLORS } from '../types';

interface StatusBadgeProps {
  status: ApplicationStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
