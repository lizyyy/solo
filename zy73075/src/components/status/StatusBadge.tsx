import type { HandoverStatus } from '@/types';
import { STATUS_COLOR_MAP, STATUS_TEXT_COLOR_MAP } from '@/constants/enums';
import { cn } from '@/lib/utils';

const BORDER_COLOR_MAP: Record<HandoverStatus, string> = {
  待交接: 'border-slate-500/50',
  可放行: 'border-emerald-500/50',
  缺材料待补: 'border-amber-500/50',
  异常待核: 'border-rose-500/50',
};

const BG_TRANSPARENT_MAP: Record<HandoverStatus, string> = {
  待交接: 'bg-slate-500/15',
  可放行: 'bg-emerald-500/15',
  缺材料待补: 'bg-amber-500/15',
  异常待核: 'bg-rose-500/15',
};

interface StatusBadgeProps {
  status: HandoverStatus;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        BG_TRANSPARENT_MAP[status],
        BORDER_COLOR_MAP[status],
        STATUS_TEXT_COLOR_MAP[status],
        className
      )}
    >
      <span
        className={cn(
          'mr-1.5 h-1.5 w-1.5 rounded-full',
          STATUS_COLOR_MAP[status]
        )}
      />
      {status}
    </span>
  );
}
