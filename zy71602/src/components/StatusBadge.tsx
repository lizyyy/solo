import React from 'react';
import { cn } from '@/lib/utils';
import { LimitStatus, RiskLevel } from '../types';
import { getStatusLabel, getRiskLevelLabel } from '../utils/format';

interface StatusBadgeProps {
  status: LimitStatus;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const statusStyles: Record<LimitStatus, string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    processing: 'bg-blue-100 text-blue-800 border-blue-200',
    approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    rejected: 'bg-red-100 text-red-800 border-red-200',
    to_confirm: 'bg-orange-100 text-orange-800 border-orange-200',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded border',
        statusStyles[status],
        sizeClasses[size]
      )}
    >
      {getStatusLabel(status)}
    </span>
  );
};

interface RiskBadgeProps {
  level: RiskLevel;
  size?: 'sm' | 'md';
}

export const RiskBadge: React.FC<RiskBadgeProps> = ({ level, size = 'md' }) => {
  const riskStyles: Record<RiskLevel, string> = {
    low: 'bg-slate-100 text-slate-700 border-slate-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    high: 'bg-rose-100 text-rose-800 border-rose-200',
    critical: 'bg-red-600 text-white border-red-700',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded border',
        riskStyles[level],
        sizeClasses[size]
      )}
    >
      {getRiskLevelLabel(level)}
    </span>
  );
};
