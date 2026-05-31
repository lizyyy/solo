import { RecordStatus, RecordStatusLabel } from '../../types';

interface StatusBadgeProps {
  status: RecordStatus;
  size?: 'sm' | 'md';
}

const statusStyles: Record<RecordStatus, string> = {
  [RecordStatus.PENDING]: 'bg-gray-100 text-gray-700 border-gray-300',
  [RecordStatus.CONFIRMED]: 'bg-green-50 text-status-confirmed border-green-200',
  [RecordStatus.PENDING_MATERIAL]: 'bg-amber-50 text-status-pending border-amber-200',
  [RecordStatus.MANUAL_ADJUSTED]: 'bg-red-50 text-status-adjusted border-red-200',
};

const statusDotStyles: Record<RecordStatus, string> = {
  [RecordStatus.PENDING]: 'bg-gray-400',
  [RecordStatus.CONFIRMED]: 'bg-status-confirmed',
  [RecordStatus.PENDING_MATERIAL]: 'bg-status-pending',
  [RecordStatus.MANUAL_ADJUSTED]: 'bg-status-adjusted',
};

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center space-x-1.5 rounded-full border ${sizeClasses} ${statusStyles[status]}`}
    >
      <span className={`w-2 h-2 rounded-full ${statusDotStyles[status]}`}></span>
      <span className="font-medium">{RecordStatusLabel[status]}</span>
    </span>
  );
}
