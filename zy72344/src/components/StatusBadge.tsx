import React from 'react';
import { cn } from '@/lib/utils';
import type { AnswerStatus } from '@/types';

interface StatusBadgeProps {
  status: AnswerStatus;
}

const statusConfig: Record<AnswerStatus, { label: string; className: string }> = {
  pending: {
    label: '待审核',
    className: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  reviewing: {
    label: '复核中',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  normal: {
    label: '正常',
    className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  exception: {
    label: '异常',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md border',
        config.className
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full mr-1.5',
          status === 'pending' && 'bg-slate-400',
          status === 'reviewing' && 'bg-amber-500',
          status === 'normal' && 'bg-emerald-500',
          status === 'exception' && 'bg-red-500'
        )}
      />
      {config.label}
    </span>
  );
};

export default StatusBadge;
