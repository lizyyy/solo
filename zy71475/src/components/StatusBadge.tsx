import type { RecordStatus } from '@/types';
import { clsx } from 'clsx';

const STATUS_CONFIG: Record<RecordStatus, { label: string; bg: string; text: string; dot: string }> = {
  processed: { label: '已处理', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  pending: { label: '待确认', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  returned: { label: '需退回', bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
};

interface StatusBadgeProps {
  status: RecordStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        config.bg,
        config.text,
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      )}
    >
      <span className={clsx('rounded-full', config.dot, size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2')} />
      {config.label}
    </span>
  );
}
