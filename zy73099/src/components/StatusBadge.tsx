import type { ItemStatus } from '@/types';
import { cn } from '@/lib/utils';
import { CheckCircle, Clock, AlertTriangle, RotateCcw } from 'lucide-react';

const STATUS_CONFIG: Record<ItemStatus, { label: string; className: string; icon: typeof CheckCircle }> = {
  pending: {
    label: '待确认',
    className: 'bg-amber-50 text-amber-800 border-amber-200 ring-amber-100',
    icon: Clock,
  },
  confirmed: {
    label: '已确认',
    className: 'bg-emerald-50 text-emerald-800 border-emerald-200 ring-emerald-100',
    icon: CheckCircle,
  },
  awaiting_patch: {
    label: '待补件',
    className: 'bg-orange-50 text-orange-800 border-orange-200 ring-orange-100',
    icon: AlertTriangle,
  },
  reverted: {
    label: '已退回',
    className: 'bg-rose-50 text-rose-800 border-rose-200 ring-rose-100',
    icon: RotateCcw,
  },
};

export function StatusBadge({
  status,
  size = 'md',
}: {
  status: ItemStatus;
  size?: 'sm' | 'md';
}) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 font-medium ring-1 ring-inset transition-all',
        cfg.className,
        size === 'sm' ? 'text-[11px] leading-4' : 'text-xs leading-5'
      )}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} strokeWidth={2.2} />
      {cfg.label}
    </span>
  );
}
