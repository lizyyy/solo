import React from 'react';
import { CableStatus, STATUS_LABELS } from '@/types';

interface StatusBadgeProps {
  status: CableStatus;
  size?: 'sm' | 'md';
}

const statusStyles: Record<CableStatus, string> = {
  confirmed: 'bg-signal-green/10 text-signal-green border-signal-green/30',
  pending: 'bg-signal-orange/10 text-signal-orange border-signal-orange/30',
  manual: 'bg-signal-blue/10 text-signal-blue border-signal-blue/30',
};

const statusDotStyles: Record<CableStatus, string> = {
  confirmed: 'bg-signal-green',
  pending: 'bg-signal-orange',
  manual: 'bg-signal-blue',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';
  
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded border font-medium ${sizeClasses} ${statusStyles[status]}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${statusDotStyles[status]}`} />
      {STATUS_LABELS[status]}
    </span>
  );
};
