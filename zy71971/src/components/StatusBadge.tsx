import type { QAStatus } from '@/types';
import { STATUS_LABELS } from '@/types';
import { cn } from '@/lib/utils';

const statusStyles: Record<QAStatus, string> = {
  normal: 'bg-emerald-400/15 text-emerald-400 border-emerald-400/30',
  pending: 'bg-rose-400/15 text-rose-400 border-rose-400/30',
  confirmed: 'bg-blue-400/15 text-blue-400 border-blue-400/30',
  rejected: 'bg-orange-400/15 text-orange-400 border-orange-400/30',
  known_issue: 'bg-amber-400/15 text-amber-400 border-amber-400/30',
};

export default function StatusBadge({ status, size = 'sm' }: { status: QAStatus; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cn(
        'inline-flex items-center border rounded-full font-medium',
        statusStyles[status],
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
