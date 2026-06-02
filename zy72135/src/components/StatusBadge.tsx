import { statusLabels, type RecordStatus } from '../../shared/types';

interface StatusBadgeProps {
  status: RecordStatus;
}

const statusStyles: Record<RecordStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 border border-amber-200',
  approved: 'bg-green-100 text-green-700 border border-green-200',
  needs_supplement: 'bg-blue-100 text-blue-700 border border-blue-200',
  obsolete: 'bg-gray-100 text-gray-600 border border-gray-200',
};

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`status-badge ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}
