import { SampleStatus } from '../types';

interface StatusBadgeProps {
  status: SampleStatus;
  isAnomaly?: boolean;
}

const statusConfig: Record<SampleStatus, { label: string; className: string }> = {
  pending_review: { label: '待运营复核', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  confirmed_normal: { label: '已确认正常', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  needs_attention: { label: '需重点关注', className: 'bg-rose-100 text-rose-800 border-rose-200' },
};

export function StatusBadge({ status, isAnomaly }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border ${config.className}`}>
      {isAnomaly && (
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5 animate-pulse" />
      )}
      {config.label}
    </span>
  );
}
