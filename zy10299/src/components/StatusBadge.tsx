import React from 'react';
import { ReissueRequest } from '../types';

interface StatusBadgeProps {
  status: ReissueRequest['status'];
}

const statusConfig = {
  pending: { label: '待处理', className: 'bg-yellow-100 text-yellow-800' },
  approved: { label: '已批准', className: 'bg-blue-100 text-blue-800' },
  rejected: { label: '已拒绝', className: 'bg-red-100 text-red-800' },
  blocked: { label: '已拦截', className: 'bg-orange-100 text-orange-800' },
  completed: { label: '已完成', className: 'bg-green-100 text-green-800' }
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status];
  return (
    <span className={`badge ${config.className}`}>
      {config.label}
    </span>
  );
};

export default StatusBadge;
