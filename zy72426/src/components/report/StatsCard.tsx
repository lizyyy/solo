import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'gray';
  className?: string;
}

const colorClasses = {
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  green: 'bg-green-50 border-green-200 text-green-700',
  amber: 'bg-amber-50 border-amber-200 text-amber-700',
  red: 'bg-red-50 border-red-200 text-red-700',
  gray: 'bg-gray-50 border-gray-200 text-gray-700',
};

export const StatsCard = ({ title, value, subtitle, icon, color = 'blue', className }: StatsCardProps) => {
  return (
    <div className={cn('rounded-sm border p-5', colorClasses[color], className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-3xl font-bold mt-2">{value}</p>
          {subtitle && <p className="text-xs opacity-70 mt-1">{subtitle}</p>}
        </div>
        {icon && <div className="opacity-80">{icon}</div>}
      </div>
    </div>
  );
};
