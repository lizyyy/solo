import type { ReportStatus, AnomalyStatus } from '../../types';

interface StatusBadgeProps {
  status: ReportStatus | AnomalyStatus;
  type?: 'report' | 'anomaly';
}

const reportStatusConfig: Record<ReportStatus, { label: string; className: string }> = {
  normal: { label: '正常', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  pending_review: { label: '待复核', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  reviewed: { label: '已复核', className: 'bg-sky-100 text-sky-700 border-sky-200' },
};

const anomalyStatusConfig: Record<AnomalyStatus, { label: string; className: string }> = {
  open: { label: '待处理', className: 'bg-rose-100 text-rose-700 border-rose-200' },
  in_progress: { label: '处理中', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  resolved: { label: '已解决', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
};

export function StatusBadge({ status, type = 'report' }: StatusBadgeProps) {
  const config = type === 'report' ? reportStatusConfig[status as ReportStatus] : anomalyStatusConfig[status as AnomalyStatus];
  
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${config.className}`}>
      {config.label}
    </span>
  );
}
