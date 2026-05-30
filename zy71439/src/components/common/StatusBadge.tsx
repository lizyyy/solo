import React from 'react';
import { WorkflowStatus } from '../../types';
import { getStatusLabel, getStatusColor } from '../../utils/formatters';

interface StatusBadgeProps {
  status: WorkflowStatus;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const baseClasses = `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusColor(status)}`;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    md: 'px-2.5 py-0.5 text-xs',
    lg: 'px-3 py-1 text-sm'
  };

  const statusIcons = {
    [WorkflowStatus.PENDING]: '⏳',
    [WorkflowStatus.APPROVED]: '✅',
    [WorkflowStatus.RETURNED]: '❌'
  };

  return (
    <span className={`${baseClasses} ${sizeClasses[size]}`}>
      <span className="mr-1">{statusIcons[status]}</span>
      {getStatusLabel(status)}
    </span>
  );
};

export default StatusBadge;
