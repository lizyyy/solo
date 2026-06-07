import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'normal' | 'pending' | 'conflict';
}

const statusConfig = {
  normal: { label: '正常', className: 'bg-emerald-100 text-emerald-700' },
  pending: { label: '待处理', className: 'bg-amber-100 text-amber-700' },
  conflict: { label: '有冲突', className: 'bg-red-100 text-red-700' },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded text-xs font-medium', config.className)}>
      {config.label}
    </span>
  );
}
