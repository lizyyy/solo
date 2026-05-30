import React from 'react';
import { cn } from '@/lib/utils';
import type { MaterialStatus, IssueSeverity, ProjectStatus } from '@/types';

interface StatusBadgeProps {
  status: MaterialStatus | IssueSeverity | ProjectStatus;
  type?: 'material' | 'issue' | 'project';
  children?: React.ReactNode;
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-bg-tertiary', text: 'text-text-muted', label: '待处理' },
  parsing: { bg: 'bg-accent-warning/20', text: 'text-accent-warning', label: '解析中' },
  success: { bg: 'bg-accent-success/20', text: 'text-accent-success', label: '成功' },
  failed: { bg: 'bg-accent-error/20', text: 'text-accent-error', label: '失败' },
  warning: { bg: 'bg-accent-warning/20', text: 'text-accent-warning', label: '警告' },
  error: { bg: 'bg-accent-error/20', text: 'text-accent-error', label: '错误' },
  draft: { bg: 'bg-bg-tertiary', text: 'text-text-muted', label: '草稿' },
  uploading: { bg: 'bg-accent-warning/20', text: 'text-accent-warning', label: '上传中' },
  processing: { bg: 'bg-accent-warning/20', text: 'text-accent-warning', label: '处理中' },
  completed: { bg: 'bg-accent-success/20', text: 'text-accent-success', label: '已完成' },
  has_issues: { bg: 'bg-accent-error/20', text: 'text-accent-error', label: '存在问题' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, children }) => {
  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium',
      config.bg,
      config.text
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full', config.text.replace('text-', 'bg-'))} />
      {children || config.label}
    </span>
  );
};
