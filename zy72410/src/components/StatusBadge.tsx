import type { ReactNode } from 'react';

interface StatusBadgeProps {
  status: 'reused' | 'new' | 'conflict' | 'rework' | 'normal' | 'completed' | 'pending';
  children?: ReactNode;
}

const statusLabels: Record<string, string> = {
  reused: '复用',
  new: '新增',
  conflict: '冲突',
  rework: '返工',
  normal: '正常',
  completed: '已完成',
  pending: '待复核',
};

export default function StatusBadge({ status, children }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-${status}`}>
      {children || statusLabels[status]}
    </span>
  );
}
