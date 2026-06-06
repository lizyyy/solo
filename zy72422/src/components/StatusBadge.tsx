import type { RecordStatus } from '../types';

interface StatusBadgeProps {
  status: RecordStatus;
}

const statusConfig: Record<RecordStatus, { label: string; className: string }> = {
  pending: {
    label: '处理中',
    className: 'bg-accent-infoLight text-accent-info border border-accent-info/30',
  },
  normal: {
    label: '正常',
    className: 'bg-accent-successLight text-accent-success border border-accent-success/30',
  },
  review: {
    label: '待复核',
    className: 'bg-accent-warningLight text-accent-warning border border-accent-warning/30',
  },
  completed: {
    label: '已完成',
    className: 'bg-primary-100 text-primary-700 border border-primary-300',
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
