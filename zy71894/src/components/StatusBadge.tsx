import type { ScheduleStatus } from '@/types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: ScheduleStatus;
  className?: string;
}

const statusConfig: Record<ScheduleStatus, { label: string; className: string }> = {
  pending: {
    label: '待处理',
    className: 'bg-gray-100 text-gray-800 border-gray-300',
  },
  scheduled: {
    label: '已排程',
    className: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  completed: {
    label: '已完成',
    className: 'bg-green-100 text-green-800 border-green-300',
  },
  failed: {
    label: '未通过',
    className: 'bg-red-100 text-red-800 border-red-300',
  },
  warning: {
    label: '有警告',
    className: 'bg-amber-100 text-amber-800 border-amber-300',
  },
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 text-xs font-medium border rounded-none',
        config.className,
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-none mr-1.5', {
        'bg-gray-500': status === 'pending',
        'bg-blue-600': status === 'scheduled',
        'bg-green-600': status === 'completed',
        'bg-red-600': status === 'failed',
        'bg-amber-600': status === 'warning',
      })} />
      {config.label}
    </span>
  );
}
