import React from 'react';
import type { RecordStatus, AnomalySeverity, ExecutionStatus, AnomalyStatus } from '@/types';

interface StatusBadgeProps {
  status: RecordStatus | AnomalySeverity | ExecutionStatus | AnomalyStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClass = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';
  
  const styles: Record<string, string> = {
    normal: 'bg-success-50 text-success-600 border border-success-200',
    warning: 'bg-warning-50 text-warning-600 border border-warning-200',
    anomaly: 'bg-danger-50 text-danger-600 border border-danger-200',
    low: 'bg-warning-50 text-warning-600 border border-warning-200',
    medium: 'bg-warning-100 text-warning-700 border border-warning-300',
    high: 'bg-danger-50 text-danger-600 border border-danger-200',
    critical: 'bg-danger-600 text-white border border-danger-700',
    pending: 'bg-primary-100 text-primary-600 border border-primary-200',
    running: 'bg-info-50 text-info-600 border border-info-200',
    completed: 'bg-success-50 text-success-600 border border-success-200',
    failed: 'bg-danger-50 text-danger-600 border border-danger-200',
    cancelled: 'bg-primary-100 text-primary-500 border border-primary-200',
    open: 'bg-danger-50 text-danger-600 border border-danger-200',
    resolved: 'bg-success-50 text-success-600 border border-success-200',
    ignored: 'bg-primary-100 text-primary-500 border border-primary-200'
  };

  const labels: Record<string, string> = {
    normal: '正常',
    warning: '警告',
    anomaly: '异常',
    low: '低危',
    medium: '中危',
    high: '高危',
    critical: '严重',
    pending: '等待中',
    running: '运行中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
    open: '待处理',
    resolved: '已解决',
    ignored: '已忽略'
  };

  return (
    <span className={`inline-flex items-center font-mono font-medium ${sizeClass} ${styles[status] || styles.normal}`}>
      {labels[status] || status}
    </span>
  );
};
