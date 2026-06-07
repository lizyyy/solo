import type { ScheduleStatus } from '../types';

interface StatusBadgeProps {
  status: ScheduleStatus;
}

const statusConfig: Record<ScheduleStatus, { label: string; className: string }> = {
  normal: {
    label: '正常',
    className: 'bg-success-100 text-success-700 border-success-200',
  },
  pending_review: {
    label: '待复核',
    className: 'bg-warning-100 text-warning-700 border-warning-200',
  },
  supplemented: {
    label: '补录',
    className: 'bg-supplement-100 text-supplement-700 border-supplement-200',
  },
  conflict: {
    label: '冲突',
    className: 'bg-red-100 text-red-700 border-red-200',
  },
  reviewed: {
    label: '已复核',
    className: 'bg-primary-100 text-primary-700 border-primary-200',
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5"></span>
      {config.label}
    </span>
  );
}
