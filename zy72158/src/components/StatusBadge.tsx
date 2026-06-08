import { ApprovalStatus } from '@/types';

interface StatusBadgeProps {
  status: ApprovalStatus;
}

const statusConfig: Record<ApprovalStatus, { label: string; className: string }> = {
  pending: { label: '待审批', className: 'bg-orange-100 text-orange-800' },
  approved: { label: '审批通过', className: 'bg-green-100 text-green-800' },
  rejected: { label: '审批驳回', className: 'bg-red-100 text-red-800' },
  need_confirm: { label: '需人工确认', className: 'bg-yellow-100 text-yellow-800' },
  legacy: { label: '历史遗留', className: 'bg-gray-100 text-gray-800' },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}
