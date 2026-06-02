import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  color?: 'blue' | 'green' | 'orange' | 'red';
  trend?: number;
  className?: string;
}

const colorClasses: Record<string, string> = {
  blue: 'from-blue-500/20 to-blue-600/10 text-blue-400 border-blue-500/30',
  green: 'from-green-500/20 to-green-600/10 text-green-400 border-green-500/30',
  orange: 'from-orange-500/20 to-orange-600/10 text-orange-400 border-orange-500/30',
  red: 'from-red-500/20 to-red-600/10 text-red-400 border-red-500/30'
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon: Icon,
  color = 'blue',
  trend,
  className
}) => {
  return (
    <div
      className={cn(
        'rounded-xl border bg-gradient-to-br p-4 backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:shadow-lg',
        colorClasses[color],
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm opacity-80">{title}</p>
          <p className="mt-1 text-2xl font-bold font-mono">{value}</p>
          {trend !== undefined && (
            <p className={cn(
              'mt-1 text-xs',
              trend >= 0 ? 'text-green-400' : 'text-red-400'
            )}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}% 较上月
            </p>
          )}
        </div>
        <div className={cn(
          'rounded-lg p-3',
          color === 'blue' && 'bg-blue-500/20',
          color === 'green' && 'bg-green-500/20',
          color === 'orange' && 'bg-orange-500/20',
          color === 'red' && 'bg-red-500/20'
        )}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
};
