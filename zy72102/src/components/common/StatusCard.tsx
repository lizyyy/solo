import React from 'react';
import { cn } from '../../lib/utils';

interface StatusCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  status?: 'normal' | 'warning' | 'critical';
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function StatusCard({
  title,
  value,
  subtitle,
  status = 'normal',
  icon,
  onClick,
  className,
}: StatusCardProps) {
  const statusStyles = {
    normal: 'border-l-cyan-500 bg-slate-800/50',
    warning: 'border-l-orange-500 bg-orange-500/10',
    critical: 'border-l-red-500 bg-red-500/10',
  };

  const statusTextColors = {
    normal: 'text-white',
    warning: 'text-orange-400',
    critical: 'text-red-400',
  };

  return (
    <div
      className={cn(
        'rounded-lg border-l-4 p-4 transition-all hover:shadow-lg',
        statusStyles[status],
        onClick && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <p className={cn('mt-1 text-2xl font-bold', statusTextColors[status])}>
            {value}
          </p>
          {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {icon && (
          <div className={cn('rounded-lg p-2', status !== 'normal' && 'bg-slate-700/50')}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
