import React from 'react';
import { MaterialStatus } from '../types';

interface StatusBadgeProps {
  status: MaterialStatus;
}

const statusConfig: Record<MaterialStatus, { label: string; className: string }> = {
  pending: { label: '待处理', className: 'status-pending' },
  approved: { label: '已通过', className: 'status-approved' },
  rejected: { label: '已拒绝', className: 'status-rejected' },
  needs_revision: { label: '需修改', className: 'status-needs_revision' },
  auth_expired: { label: '授权过期', className: 'status-auth_expired' },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status];
  return (
    <span className={`status-badge ${config.className}`}>
      {config.label}
    </span>
  );
};
