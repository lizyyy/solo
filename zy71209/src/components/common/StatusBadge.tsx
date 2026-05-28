import type { PledgeStatus, SupplementStatus, ExtensionStatus, DisposalStatus } from '../../types';

interface StatusBadgeProps {
  status: PledgeStatus | SupplementStatus | ExtensionStatus | DisposalStatus | string;
  type?: 'pledge' | 'supplement' | 'extension' | 'disposal';
}

const statusConfig: Record<string, { label: string; className: string }> = {
  normal: { label: '正常', className: 'bg-green-100 text-green-800' },
  warning: { label: '预警', className: 'bg-red-100 text-red-800' },
  close: { label: '平仓', className: 'bg-red-600 text-white' },
  extended: { label: '已展期', className: 'bg-purple-100 text-purple-800' },
  disposed: { label: '已处置', className: 'bg-gray-100 text-gray-800' },
  pending: { label: '待处理', className: 'bg-orange-100 text-orange-800' },
  received: { label: '已到账', className: 'bg-green-100 text-green-800' },
  cancelled: { label: '已取消', className: 'bg-gray-100 text-gray-800' },
  approved: { label: '已通过', className: 'bg-green-100 text-green-800' },
  rejected: { label: '已拒绝', className: 'bg-red-100 text-red-800' },
  draft: { label: '草稿', className: 'bg-gray-100 text-gray-800' },
  submitted: { label: '已提交', className: 'bg-blue-100 text-blue-800' },
  completed: { label: '已完成', className: 'bg-green-100 text-green-800' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800' };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
