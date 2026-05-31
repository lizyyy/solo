import React from 'react';
import { KnowledgeStatus } from '@/types';
import { statusToText } from '@/utils/processing';

interface StatusBadgeProps {
  status: KnowledgeStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const statusClass = {
    confirmed: 'status-confirmed',
    pending: 'status-pending',
    modified: 'status-modified',
  }[status];

  return (
    <span className={`status-badge ${statusClass} transition-transform duration-200 hover:scale-105`}>
      {statusToText(status)}
    </span>
  );
};
