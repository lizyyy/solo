import { cn } from '@/lib/utils';
import type { TaskStatus, LayerStatus } from '@shared/types';

type Status = TaskStatus | LayerStatus;

const statusText: Record<Status, string> = {
  pending: '待处理',
  in_progress: '复核中',
  completed: '已完成',
  has_legacy: '遗留问题',
  approved: '审核通过',
  needs_modify: '需修改',
  rejected: '已驳回',
};

const statusClasses: Record<Status, string> = {
  pending: 'bg-status-pending/15 text-status-pending border-status-pending/30',
  in_progress: 'bg-status-in_progress/15 text-status-in_progress border-status-in_progress/30',
  completed: 'bg-status-completed/15 text-status-completed border-status-completed/30',
  has_legacy: 'bg-status-has_legacy/15 text-status-has_legacy border-status-has_legacy/30',
  approved: 'bg-status-approved/15 text-status-approved border-status-approved/30',
  needs_modify: 'bg-status-needs_modify/15 text-status-needs_modify border-status-needs_modify/30',
  rejected: 'bg-status-rejected/15 text-status-rejected border-status-rejected/30',
};

interface StatusBadgeProps {
  status: Status;
  className?: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, className, size = 'md' }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        statusClasses[status],
        className,
      )}
    >
      <span
        className={cn(
          'mr-1.5 inline-block h-1.5 w-1.5 rounded-full',
          `bg-status-${status}`,
        )}
      />
      {statusText[status]}
    </span>
  );
}
