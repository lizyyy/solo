import { RecordStatus, StatusLabelMap } from '../../types';

interface StatusBadgeProps {
  status: RecordStatus;
  size?: 'sm' | 'md';
}

const statusColorMap: Record<RecordStatus, string> = {
  [RecordStatus.PENDING]: 'bg-slate-100 text-slate-700 border-slate-200',
  [RecordStatus.PASSED]: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  [RecordStatus.REJECTED]: 'bg-rose-50 text-rose-700 border-rose-200',
  [RecordStatus.REWORK]: 'bg-amber-50 text-amber-700 border-amber-200',
  [RecordStatus.WRONG_CRITERIA]: 'bg-orange-50 text-orange-700 border-orange-200',
  [RecordStatus.PM_REVIEW]: 'bg-amber-100 text-amber-800 border-amber-300',
  [RecordStatus.REVIEW_PASSED]: 'bg-teal-50 text-teal-700 border-teal-200',
  [RecordStatus.REVIEW_REJECTED]: 'bg-red-50 text-red-700 border-red-200'
};

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm';

  return (
    <span
      className={`inline-flex items-center rounded-md border font-medium ${sizeClass} ${statusColorMap[status]}`}
    >
      {StatusLabelMap[status]}
    </span>
  );
}
