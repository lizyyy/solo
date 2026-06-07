import type { ReviewStatus, AutoResult, ReviewState } from '@/types';

interface StatusBadgeProps {
  status: ReviewStatus | AutoResult | ReviewState;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: '草稿', className: 'bg-slate-100 text-slate-700' },
  REVIEWING: { label: '审查中', className: 'bg-blue-100 text-blue-700' },
  PENDING_REVIEW: { label: '待复核', className: 'bg-amber-100 text-amber-700' },
  CONFIRMED: { label: '已确认', className: 'bg-emerald-100 text-emerald-700' },
  PASS: { label: '通过', className: 'bg-emerald-100 text-emerald-700' },
  FAIL: { label: '未通过', className: 'bg-red-100 text-red-700' },
  PENDING: { label: '待处理', className: 'bg-slate-100 text-slate-700' },
  APPROVED: { label: '已批准', className: 'bg-emerald-100 text-emerald-700' },
  REJECTED: { label: '已拒绝', className: 'bg-red-100 text-red-700' },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: 'bg-slate-100 text-slate-700' };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
