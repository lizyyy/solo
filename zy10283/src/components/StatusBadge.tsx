import React from 'react';
import { RepairStatus, statusLabels, statusColors } from '../types';

interface StatusBadgeProps {
  status: RepairStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}>
      {statusLabels[status]}
    </span>
  );
};
