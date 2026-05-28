import { BusinessStatus } from '@/types';
import { STATUS_LABELS, STATUS_COLORS } from '@/constants/purposeCodes';

interface StatusBadgeProps {
  status: BusinessStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge = ({ status, size = 'md' }: StatusBadgeProps) => {
  const label = STATUS_LABELS[status] || status;
  const colorClass = STATUS_COLORS[status] || 'bg-gray-100 text-gray-700 border-gray-300';
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center border rounded font-medium ${colorClass} ${sizeClass} transition-all duration-200`}
    >
      <span className="mr-1.5 w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
};
