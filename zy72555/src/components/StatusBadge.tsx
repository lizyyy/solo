import type { LogStatus } from '@/types';
import { AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: LogStatus;
  isBoundaryCase?: boolean;
}

const statusConfig: Record<LogStatus, { label: string; bgClass: string; textClass: string; Icon: any }> = {
  pending: {
    label: '未处理',
    bgClass: 'bg-slate-700/50',
    textClass: 'text-slate-300',
    Icon: Clock,
  },
  reviewing: {
    label: '待复核',
    bgClass: 'bg-amber-900/50',
    textClass: 'text-amber-400',
    Icon: AlertTriangle,
  },
  confirmed: {
    label: '已确认',
    bgClass: 'bg-emerald-900/50',
    textClass: 'text-emerald-400',
    Icon: CheckCircle,
  },
  rejected: {
    label: '已驳回',
    bgClass: 'bg-red-900/50',
    textClass: 'text-red-400',
    Icon: XCircle,
  },
};

export function StatusBadge({ status, isBoundaryCase }: StatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.Icon;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium ${config.bgClass} ${config.textClass}`}>
      <Icon size={12} />
      {config.label}
      {isBoundaryCase && status === 'reviewing' && (
        <span className="ml-1 px-1 rounded bg-amber-500/20 text-amber-300 text-[10px]">边界</span>
      )}
    </span>
  );
}
