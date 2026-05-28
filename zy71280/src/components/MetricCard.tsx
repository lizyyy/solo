import React from 'react';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendValue,
  className,
}) => {
  return (
    <div className={cn(
      'bg-white border border-slate-200 rounded-md p-5 shadow-sm hover:shadow-md transition-shadow',
      className
    )}>
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
      )}
      {trend && trendValue && (
        <p className={cn(
          'mt-2 text-xs font-medium',
          trend === 'up' && 'text-emerald-600',
          trend === 'down' && 'text-red-600',
          trend === 'neutral' && 'text-slate-500'
        )}>
          {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
        </p>
      )}
    </div>
  );
};
