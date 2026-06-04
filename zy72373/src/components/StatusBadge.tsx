import type { TaskStatus } from '../types';

interface StatusBadgeProps {
  status: TaskStatus;
}

const statusConfig: Record<TaskStatus, { label: string; className: string }> = {
  importing: { label: '数据导入中', className: 'badge-info' },
  pending_review: { label: '待老唐复核', className: 'badge-review' },
  photo_added: { label: '已补录照片', className: 'badge-pending' },
  reviewing: { label: '复核中', className: 'badge-pending' },
  completed: { label: '已完成', className: 'badge-success' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span className={`badge ${config.className}`}>
      {config.label}
    </span>
  );
}
