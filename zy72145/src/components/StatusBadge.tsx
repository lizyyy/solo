import { ValidationStatus, STATUS_LABELS, STATUS_COLORS } from '../types';
import { CheckCircle, Clock, AlertTriangle, CopyX, FileWarning } from 'lucide-react';

interface StatusBadgeProps {
  status: ValidationStatus;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

const statusIcons: Record<ValidationStatus, typeof CheckCircle> = {
  normal: CheckCircle,
  auth_expired: Clock,
  tc_mismatch: AlertTriangle,
  duplicate: CopyX,
  dirty_data: FileWarning,
};

export default function StatusBadge({ status, showIcon = true, size = 'md' }: StatusBadgeProps) {
  const Icon = statusIcons[status];
  const label = STATUS_LABELS[status];
  const colorClass = STATUS_COLORS[status];
  const sizeClass = size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1 font-medium border rounded ${colorClass} ${sizeClass} transition-transform hover:scale-105`}
      title={label}
      style={{ clipPath: 'polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px)' }}
    >
      {showIcon && <Icon size={size === 'sm' ? 12 : 14} />}
      {label}
    </span>
  );
}
