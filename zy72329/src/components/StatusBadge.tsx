import { cn } from '../lib/utils';
import { RecordStatus } from '../../shared/types';

const statusConfig: Record<RecordStatus, { label: string; variant: string }> = {
  smooth: { label: '正常', variant: 'success' },
  gap: { label: '断档', variant: 'warning' },
  supplement: { label: '补录', variant: 'supplement' },
  conflict: { label: '冲突', variant: 'danger' },
  pending: { label: '待处理', variant: 'pending' },
  approved: { label: '已通过', variant: 'success' },
  rejected: { label: '已拒绝', variant: 'danger' },
  reviewed_normal: { label: '复核正常', variant: 'success' },
  reviewed_abnormal: { label: '复核异常', variant: 'danger' },
};

const variantClasses: Record<string, string> = {
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-orange-100 text-orange-800 border-orange-200',
  supplement: 'bg-purple-100 text-purple-800 border-purple-200',
  danger: 'bg-red-100 text-red-800 border-red-200',
  pending: 'bg-slate-100 text-slate-600 border-slate-200',
};

const warningPattern = {
  backgroundImage:
    'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(251, 146, 60, 0.3) 4px, rgba(251, 146, 60, 0.3) 8px)',
};

interface StatusBadgeProps {
  status: RecordStatus;
  className?: string;
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  if (!config) {
    return null;
  }

  const isWarning = config.variant === 'warning';

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        variantClasses[config.variant],
        isWarning && 'bg-orange-50',
        className
      )}
      style={isWarning ? warningPattern : undefined}
    >
      {config.label}
    </span>
  );
}
