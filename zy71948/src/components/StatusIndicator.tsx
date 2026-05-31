import React from 'react';
import { BudgetStatus, AnomalyStatus } from '../types';

interface StatusIndicatorProps {
  status: BudgetStatus | AnomalyStatus;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4'
};

const statusClasses: Record<string, string> = {
  NORMAL: 'bg-eng-green',
  WARNING: 'bg-eng-orange animate-blink',
  ERROR: 'bg-eng-orange animate-blink',
  PENDING: 'bg-eng-yellow animate-pulse-slow',
  CONFIRMED: 'bg-eng-green',
  RESOLVED: 'bg-eng-green'
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, size = 'md' }) => {
  return (
    <span
      className={`inline-block rounded-full ${sizeClasses[size]} ${statusClasses[status] || 'bg-gray-500'}`}
    />
  );
};
