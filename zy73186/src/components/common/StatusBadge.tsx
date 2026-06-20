import React from 'react';
import { cn } from '@/lib/utils';
import type { SessionStatus, SuspendedStatus } from '@/types';
import { STATUS_LABELS } from '@/types';

interface StatusBadgeProps {
  status: SessionStatus | SuspendedStatus;
  size?: 'sm' | 'md';
  className?: string;
}

const statusColors: Record<string, string> = {
  draft: 'bg-[#4a5568] text-[#e2e8f0] border-[#718096]',
  pending: 'bg-[#2c5282] text-[#bee3f8] border-[#3182ce]',
  computing: 'bg-[#2b6cb0] text-[#bee3f8] border-[#4299e1]',
  suspended: 'bg-[#c05621] text-[#feebc8] border-[#dd6b20]',
  completed: 'bg-[#276749] text-[#c6f6d5] border-[#38a169]',
  confirmed: 'bg-[#276749] text-[#c6f6d5] border-[#38a169]',
  rejected: 'bg-[#c53030] text-[#fed7d7] border-[#e53e3e]',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  className,
}) => {
  const label = STATUS_LABELS[status as SessionStatus] || status;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono rounded border',
        statusColors[status] || statusColors.draft,
        sizeStyles[size],
        className
      )}
    >
      <span
        className={cn(
          'w-2 h-2 rounded-full',
          status === 'computing' ? 'animate-pulse' : ''
        )}
        style={{
          backgroundColor:
            status === 'completed' || status === 'confirmed'
              ? '#38a169'
              : status === 'suspended' || status === 'rejected'
              ? '#dd6b20'
              : '#4299e1',
        }}
      />
      {label}
    </span>
  );
};
