import React from 'react';
import { cn } from '../../lib/utils';

interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon?: React.ReactNode;
  color?: 'default' | 'green' | 'red' | 'amber' | 'blue';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color = 'default'
}) => {
  const colorConfig = {
    default: 'from-slate-50 to-slate-100 border-slate-200 text-slate-700',
    green: 'from-emerald-50 to-emerald-100 border-emerald-200 text-emerald-700',
    red: 'from-red-50 to-red-100 border-red-200 text-red-700',
    amber: 'from-amber-50 to-amber-100 border-amber-200 text-amber-700',
    blue: 'from-blue-50 to-blue-100 border-blue-200 text-blue-700'
  };

  return (
    <div className={cn(
      'rounded-xl border bg-gradient-to-br p-5 transition-all hover:shadow-md',
      colorConfig[color]
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium opacity-80">{title}</p>
          <p className="text-3xl font-bold mt-2 tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs mt-1 opacity-70">{subtitle}</p>
          )}
        </div>
        {icon && (
          <div className="p-2 rounded-lg bg-white/60 backdrop-blur-sm">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
};
