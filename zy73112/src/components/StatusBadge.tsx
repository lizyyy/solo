import type { TrackingStatus } from '../types';

interface StatusBadgeProps {
  status: TrackingStatus;
}

const statusConfig: Record<TrackingStatus, { label: string; className: string }> = {
  pending: { label: '待确认', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  confirmed: { label: '已确认', className: 'bg-green-100 text-green-700 border-green-200' },
  supplement: { label: '待补件', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  returned: { label: '已退回', className: 'bg-red-100 text-red-700 border-red-200' },
  bad_data: { label: '坏数据', className: 'bg-slate-200 text-slate-600 border-slate-300' },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border ${config.className}`}>
      {config.label}
    </span>
  );
}
