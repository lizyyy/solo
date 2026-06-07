import { SampleStatus, ReviewStatus, AnomalyType } from '@/types';

interface StatusBadgeProps {
  status: SampleStatus | ReviewStatus | AnomalyType;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  normal: { label: '正常', className: 'bg-success-500/20 text-success-400 border-success-500/30' },
  time_window_inflated: { label: '时间窗虚高', className: 'bg-warning-500/20 text-warning-400 border-warning-500/30' },
  old_caliber: { label: '旧口径', className: 'bg-primary-500/20 text-primary-400 border-primary-500/30' },
  pending_review: { label: '待复核', className: 'bg-warning-500/20 text-warning-400 border-warning-500/30 animate-pulse-soft' },
  reviewed: { label: '已复核', className: 'bg-success-500/20 text-success-400 border-success-500/30' },
  rejected: { label: '已驳回', className: 'bg-danger-500/20 text-danger-400 border-danger-500/30' },
  time_window: { label: '时间窗穿越', className: 'bg-warning-500/20 text-warning-400 border-warning-500/30' },
  other: { label: '其他异常', className: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: 'bg-slate-500/20 text-slate-400' };
  
  return (
    <span className={`status-badge border ${config.className}`}>
      {config.label}
    </span>
  );
}
