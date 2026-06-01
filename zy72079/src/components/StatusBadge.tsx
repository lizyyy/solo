import type { RecordStatus } from '../types';
import { CheckCircle, Clock, AlertTriangle, Database } from 'lucide-react';

interface StatusBadgeProps {
  status: RecordStatus;
}

const statusConfig = {
  success: { label: '顺利完成', icon: CheckCircle, className: 'status-success' },
  pending: { label: '待确认', icon: Clock, className: 'status-pending' },
  legacy: { label: '旧口径', icon: Database, className: 'status-legacy' },
  error: { label: '计算失败', icon: AlertTriangle, className: 'status-error' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <span className={`status-badge ${config.className}`}>
      <Icon className="w-3 h-3 mr-1" />
      {config.label}
    </span>
  );
}
