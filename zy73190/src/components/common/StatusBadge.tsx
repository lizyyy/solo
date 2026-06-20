import { Check, XCircle, Copy, Clock } from 'lucide-react';
import type { SampleStatus } from '@/types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: SampleStatus;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const statusConfig = {
  normal: {
    label: '正常',
    icon: Check,
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  abnormal: {
    label: '异常',
    icon: XCircle,
    className: 'bg-red-100 text-red-700 border-red-200',
  },
  duplicate: {
    label: '重复',
    icon: Copy,
    className: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  pending: {
    label: '待确认',
    icon: Clock,
    className: 'bg-sky-100 text-sky-700 border-sky-200',
  },
};

export function StatusBadge({ status, showLabel = true, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium',
        size === 'sm' ? 'text-xs' : 'text-xs',
        config.className
      )}
    >
      <Icon size={iconSize} />
      {showLabel && <span>{config.label}</span>}
    </span>
  );
}
