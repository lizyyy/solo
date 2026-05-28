import React from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ArrowUpRight,
  ArrowDownRight,
  LayoutDashboard,
} from 'lucide-react';
import { cn } from '../lib/utils';

export type StatCardVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export interface StatCardProps {
  title: string;
  value: number | string;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: StatCardVariant;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  trendLabel?: string;
  description?: string;
  prefix?: string;
  suffix?: string;
  onClick?: () => void;
  className?: string;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const variantStyles: Record<StatCardVariant, {
  bg: string;
  iconBg: string;
  iconColor: string;
  border: string;
  accent: string;
}> = {
  default: {
    bg: 'bg-white',
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-600',
    border: 'border-slate-200',
    accent: 'bg-slate-500',
  },
  primary: {
    bg: 'bg-white',
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-600',
    border: 'border-blue-100',
    accent: 'bg-blue-500',
  },
  success: {
    bg: 'bg-white',
    iconBg: 'bg-green-50',
    iconColor: 'text-green-600',
    border: 'border-green-100',
    accent: 'bg-green-500',
  },
  warning: {
    bg: 'bg-white',
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    border: 'border-amber-100',
    accent: 'bg-amber-500',
  },
  danger: {
    bg: 'bg-white',
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
    border: 'border-red-100',
    accent: 'bg-red-500',
  },
  info: {
    bg: 'bg-white',
    iconBg: 'bg-cyan-50',
    iconColor: 'text-cyan-600',
    border: 'border-cyan-100',
    accent: 'bg-cyan-500',
  },
};

const sizeStyles = {
  sm: {
    container: 'p-4',
    icon: 'w-10 h-10',
    iconInner: 'w-5 h-5',
    value: 'text-2xl',
    title: 'text-sm',
  },
  md: {
    container: 'p-5',
    icon: 'w-12 h-12',
    iconInner: 'w-6 h-6',
    value: 'text-3xl',
    title: 'text-sm',
  },
  lg: {
    container: 'p-6',
    icon: 'w-14 h-14',
    iconInner: 'w-7 h-7',
    value: 'text-4xl',
    title: 'text-base',
  },
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon = LayoutDashboard,
  variant = 'default',
  trend,
  trendValue,
  trendLabel,
  description,
  prefix,
  suffix,
  onClick,
  className,
  footer,
  size = 'md',
}) => {
  const styles = variantStyles[variant];
  const sizes = sizeStyles[size];

  const formatValue = (val: number | string): string => {
    if (typeof val === 'number') {
      return val.toLocaleString();
    }
    return val;
  };

  return (
    <div
      className={cn(
        'rounded-xl border shadow-sm overflow-hidden transition-all duration-200',
        styles.bg,
        styles.border,
        onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5',
        sizes.container,
        className
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0">
          <p className={cn('font-medium text-slate-500 mb-1', sizes.title)}>
            {title}
          </p>
          <div className="flex items-baseline gap-1">
            {prefix && (
              <span className="text-lg font-semibold text-slate-500">{prefix}</span>
            )}
            <span className={cn('font-bold text-slate-800 tracking-tight', sizes.value)}>
              {formatValue(value)}
            </span>
            {suffix && (
              <span className="text-sm font-medium text-slate-500">{suffix}</span>
            )}
          </div>
        </div>

        <div className={cn(
          'rounded-xl flex items-center justify-center flex-shrink-0 ml-4',
          styles.iconBg,
          sizes.icon
        )}>
          <Icon className={cn(sizes.iconInner, styles.iconColor)} />
        </div>
      </div>

      {(trend || description) && (
        <div className="flex items-center justify-between">
          {trend && (
            <div className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-sm font-medium',
              trend === 'up' && 'bg-red-50 text-red-600',
              trend === 'down' && 'bg-green-50 text-green-600',
              trend === 'stable' && 'bg-slate-50 text-slate-600'
            )}>
              {trend === 'up' ? (
                <ArrowUpRight className="w-4 h-4" />
              ) : trend === 'down' ? (
                <ArrowDownRight className="w-4 h-4" />
              ) : (
                <Minus className="w-4 h-4" />
              )}
              {trendValue || (trend === 'up' ? '上升' : trend === 'down' ? '下降' : '持平')}
              {trendLabel && <span className="text-xs opacity-80">({trendLabel})</span>}
            </div>
          )}

          {description && (
            <p className="text-sm text-slate-500">
              {description}
            </p>
          )}
        </div>
      )}

      {footer && (
        <div className="mt-4 pt-4 border-t border-slate-100">
          {footer}
        </div>
      )}
    </div>
  );
};

export default StatCard;
