import { ResetStatus } from '../types';

interface StatusBadgeProps {
  status: ResetStatus;
}

const statusConfig: Record<ResetStatus, { label: string; className: string }> = {
  [ResetStatus.PENDING]: { label: '待审批', className: 'status-pending' },
  [ResetStatus.APPROVED]: { label: '已批准', className: 'status-approved' },
  [ResetStatus.PROCESSING]: { label: '处理中', className: 'status-processing' },
  [ResetStatus.SUCCESS]: { label: '已成功', className: 'status-success' },
  [ResetStatus.FAILED]: { label: '已失败', className: 'status-failed' },
  [ResetStatus.BLOCKED]: { label: '已拦截', className: 'status-blocked' },
  [ResetStatus.CANCELLED]: { label: '已取消', className: 'status-cancelled' },
};

const StatusBadge = ({ status }: StatusBadgeProps) => {
  const config = statusConfig[status];
  return (
    <span className={`status-badge ${config.className}`}>
      {config.label}
    </span>
  );
};

export default StatusBadge;