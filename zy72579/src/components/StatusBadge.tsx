import { statusLabelMap, statusColorMap, typeLabelMap } from '@/types';
import type { RecordStatus, RecordType } from '@/types';

interface StatusBadgeProps {
  status: RecordStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const colorClass = statusColorMap[status];
  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium text-white ${colorClass} border border-black/10`}>
      {statusLabelMap[status]}
    </span>
  );
}

interface TypeBadgeProps {
  type: RecordType;
}

export function TypeBadge({ type }: TypeBadgeProps) {
  const colorMap: Record<RecordType, string> = {
    smooth: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    duplicate_training: 'bg-amber-50 text-amber-700 border-amber-200',
    old_caliber: 'bg-orange-50 text-orange-700 border-orange-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-1 text-xs font-medium border ${colorMap[type]}`}>
      {typeLabelMap[type]}
    </span>
  );
}
