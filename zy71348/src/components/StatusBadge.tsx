import type { RecordStatus } from '@/types';
import { STATUS_LABELS } from '@/types';

interface StatusBadgeProps {
  status: RecordStatus;
}

const statusStyles: Record<RecordStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending: 'bg-caramel-200 text-vinyl-800',
  verified: 'bg-vinyl-700 text-white',
  listed: 'bg-green-100 text-green-800',
  archived: 'bg-gray-300 text-gray-600',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`status-badge ${statusStyles[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
