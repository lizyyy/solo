import React from 'react';
import { cn } from '@/lib/utils';

interface DataCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
  onClick?: () => void;
  highlight?: boolean;
}

export const DataCard: React.FC<DataCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  icon,
  trend,
  className,
  onClick,
  highlight = false,
}) => {
  return (
    <div
      className={cn(
        'card p-4 transition-all duration-300',
        highlight && 'glow-blue border-blue-500/50',
        onClick && 'cursor-pointer hover:bg-slate-800',
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="text-xs text-slate-400 uppercase tracking-wider">{title}</div>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold font-mono text-slate-100">
          {value}
        </span>
        {unit && <span className="text-sm text-slate-400">{unit}</span>}
      </div>
      {subtitle && (
        <div className="mt-1 text-xs text-slate-500">{subtitle}</div>
      )}
      {trend && (
        <div className={cn(
          'mt-2 text-xs flex items-center gap-1',
          trend.isPositive ? 'text-emerald-400' : 'text-red-400'
        )}>
          <span>{trend.isPositive ? '↑' : '↓'}</span>
          <span>{trend.value}%</span>
        </div>
      )}
    </div>
  );
};
