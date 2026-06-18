import type { RecordStatus, ParameterType } from '@/types';
import { statusLabels, parameterTypeLabels } from '@/types';

interface StatusBadgeProps {
  status: RecordStatus;
  size?: 'sm' | 'md';
}

const statusStyles: Record<RecordStatus, string> = {
  pending: 'bg-ocean-600/30 text-ocean-200 border-ocean-500',
  confirmed: 'bg-nautical-success/20 text-nautical-successLight border-nautical-success/50',
  returned: 'bg-nautical-danger/20 text-nautical-dangerLight border-nautical-danger/50',
  supplement: 'bg-nautical-warning/20 text-nautical-warningLight border-nautical-warning/50',
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm';
  
  return (
    <span
      className={`inline-flex items-center rounded-full border ${statusStyles[status]} ${sizeClasses} font-medium`}
    >
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
        status === 'pending' ? 'bg-ocean-400' :
        status === 'confirmed' ? 'bg-nautical-success' :
        status === 'returned' ? 'bg-nautical-danger' :
        'bg-nautical-warning animate-pulse'
      }`} />
      {statusLabels[status]}
    </span>
  );
}

interface ParameterBadgeProps {
  type: ParameterType;
}

export function ParameterBadge({ type }: ParameterBadgeProps) {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-ocean-700 text-ocean-200">
      {parameterTypeLabels[type]}
    </span>
  );
}
