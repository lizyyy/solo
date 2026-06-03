import React from 'react';
import { AlertTriangle, CheckCircle, Clock, Database, XCircle } from 'lucide-react';
import type { LogStatus, AlertLevel, RecordType } from '../../shared/types';

interface StatusBadgeProps {
  status: LogStatus | AlertLevel | RecordType;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

const statusConfig = {
  success: { label: '顺利通过', icon: CheckCircle, className: 'status-success' },
  blocked: { label: '截图遮挡', icon: AlertTriangle, className: 'status-pending' },
  legacy: { label: '旧口径补录', icon: Database, className: 'status-legacy' },
  pending_review: { label: '待施工经理复核', icon: Clock, className: 'status-pending animate-pulse-slow' },
  warning: { label: '警告', icon: AlertTriangle, className: 'status-pending' },
  danger: { label: '危险', icon: XCircle, className: 'status-danger' },
  info: { label: '提示', icon: CheckCircle, className: 'status-success' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, showIcon = true, size = 'sm' }) => {
  const config = statusConfig[status] || statusConfig.info;
  const Icon = config.icon;
  const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-3 py-1';
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';
  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <span className={`status-badge ${config.className} ${padding} ${textSize} gap-1`}>
      {showIcon && <Icon size={iconSize} />}
      {config.label}
    </span>
  );
};
