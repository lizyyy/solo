import * as React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from './Badge';

export type StatusType = 'success' | 'warning' | 'error' | 'info' | 'pending' | 'processing';

export interface StatusIndicatorProps {
  status: StatusType;
  label: string;
  size?: 'sm' | 'md';
  showDot?: boolean;
  className?: string;
}

const statusConfig: Record<StatusType, { variant: 'success' | 'warning' | 'error' | 'info' | 'neutral'; icon?: React.ReactNode }> = {
  success: { variant: 'success' },
  warning: { variant: 'warning' },
  error: { variant: 'error' },
  info: { variant: 'info' },
  pending: { variant: 'neutral' },
  processing: { variant: 'info' },
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  size = 'sm',
  showDot = true,
  className,
}) => {
  const config = statusConfig[status];

  return (
    <Badge
      variant={config.variant}
      size={size}
      dot={showDot}
      className={cn(status === 'processing' && 'animate-pulse', className)}
    >
      {status === 'processing' ? (
        <span className="inline-flex items-center">
          <svg className="animate-spin w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {label}
        </span>
      ) : (
        label
      )}
    </Badge>
  );
};
StatusIndicator.displayName = 'StatusIndicator';
