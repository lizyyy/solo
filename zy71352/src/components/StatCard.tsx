import { cn } from '../lib/utils';
import type { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  description?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'emerald' | 'amber' | 'red' | 'blue' | 'default';
  delay?: number;
  className?: string;
}

const colorStyles: Record<string, { bg: string; icon: string; text: string }> = {
  emerald: {
    bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200',
    icon: 'bg-emerald-500 text-white',
    text: 'text-emerald-700',
  },
  amber: {
    bg: 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200',
    icon: 'bg-amber-500 text-white',
    text: 'text-amber-700',
  },
  red: {
    bg: 'bg-gradient-to-br from-red-50 to-red-100 border-red-200',
    icon: 'bg-red-500 text-white',
    text: 'text-red-700',
  },
  blue: {
    bg: 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200',
    icon: 'bg-blue-600 text-white',
    text: 'text-blue-700',
  },
  default: {
    bg: 'bg-gradient-to-br from-stone-50 to-stone-100 border-stone-200',
    icon: 'bg-stone-600 text-white',
    text: 'text-stone-700',
  },
};

export function StatCard({
  title,
  value,
  icon,
  description,
  trend,
  color = 'default',
  delay = 0,
  className,
}: StatCardProps) {
  const styles = colorStyles[color];

  return (
    <div
      className={cn(
      'rounded-xl border p-5 shadow-sm transition-all duration-300',
      'hover:shadow-md hover:-translate-y-0.5',
      styles.bg,
      className
    )}
      style={{
      animation: `fadeInUp 0.5s ease-out ${delay}ms both`,
    }}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-stone-600 mb-1">{title}</p>
          <p className={cn('text-3xl font-bold mt-2 tracking-tight', styles.text)}>
            {typeof value === 'number' ? value.toLocaleString() : value}
          </p>
          {description && (
            <p className="text-xs text-stone-500 mt-1">{description}</p>
          )}
          {trend && (
            <div
              className={cn(
              'inline-flex items-center gap-1 text-xs font-medium mt-2 px-2 py-0.5 rounded-full',
              trend.isPositive
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-red-100 text-red-700'
            )}
            >
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
        <div
          className={cn(
          'p-3 rounded-xl shadow-inner',
          styles.icon
        )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
