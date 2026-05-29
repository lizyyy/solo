import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  color?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
}

const colorClasses = {
  default: 'bg-slate-50 border-slate-200',
  success: 'bg-emerald-50 border-emerald-200',
  warning: 'bg-amber-50 border-amber-200',
  danger: 'bg-red-50 border-red-200'
};

const textColorClasses = {
  default: 'text-slate-900',
  success: 'text-emerald-700',
  warning: 'text-amber-700',
  danger: 'text-red-700'
};

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'default',
  className
}: StatCardProps) {
  return (
    <div className={cn(
      'rounded-xl border p-5 transition-all hover:shadow-md',
      colorClasses[color],
      className
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className={cn(
            'text-3xl font-bold mt-2',
            textColorClasses[color]
          )}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span className={cn(
                'text-xs font-medium',
                trend.value >= 0 ? 'text-emerald-600' : 'text-red-600'
              )}>
                {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}
              </span>
              <span className="text-xs text-slate-500">{trend.label}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className={cn(
            'p-3 rounded-lg',
            color === 'default' && 'bg-slate-100',
            color === 'success' && 'bg-emerald-100',
            color === 'warning' && 'bg-amber-100',
            color === 'danger' && 'bg-red-100'
          )}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
