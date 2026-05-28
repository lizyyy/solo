import { cn } from '@/lib/utils';
import { STATUS_LABELS, STATUS_COLORS, RISK_COLORS } from '../../shared/types';
import type { CaseStatus, RiskLevel, WriteOffStatus } from '../../shared/types';

interface StatusBadgeProps {
  status: CaseStatus;
  className?: string;
}

export function CaseStatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium',
        STATUS_COLORS[status],
        className
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

interface RiskBadgeProps {
  level: RiskLevel;
  className?: string;
}

export function RiskBadge({ level, className }: RiskBadgeProps) {
  const labels = {
    low: '低风险',
    medium: '中风险',
    high: '高风险',
    critical: '极高风险',
  };

  const bgColors = {
    low: 'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    high: 'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  };

  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium', bgColors[level], className)}>
      <span className={cn('w-2 h-2 rounded-full', RISK_COLORS[level])} />
      {labels[level]}
    </span>
  );
}

interface WriteOffBadgeProps {
  status: WriteOffStatus;
  className?: string;
}

export function WriteOffBadge({ status, className }: WriteOffBadgeProps) {
  const labels = {
    pending: '待核销',
    partial: '部分核销',
    full: '已核销',
  };

  const colors = {
    pending: 'bg-slate-100 text-slate-700',
    partial: 'bg-amber-100 text-amber-700',
    full: 'bg-green-100 text-green-700',
  };

  return (
    <span className={cn('inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium', colors[status], className)}>
      {labels[status]}
    </span>
  );
}
