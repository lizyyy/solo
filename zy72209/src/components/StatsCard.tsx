import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  color: 'red' | 'orange' | 'yellow' | 'green' | 'blue';
  subtitle?: string;
  trend?: {
    value: number;
    isUp: boolean;
  };
  pulse?: boolean;
}

const colorClasses = {
  red: 'from-red-500 to-red-600',
  orange: 'from-orange-500 to-orange-600',
  yellow: 'from-yellow-500 to-yellow-600',
  green: 'from-green-500 to-green-600',
  blue: 'from-blue-500 to-blue-600'
};

const bgClasses = {
  red: 'bg-red-50',
  orange: 'bg-orange-50',
  yellow: 'bg-yellow-50',
  green: 'bg-green-50',
  blue: 'bg-blue-50'
};

export function StatsCard({ title, value, icon: Icon, color, subtitle, trend, pulse }: StatsCardProps) {
  return (
    <div 
      className={cn(
        'relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-all duration-300 hover:shadow-md',
        pulse && 'animate-pulse'
      )}
    >
      <div className={cn(
        'absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br opacity-10',
        colorClasses[color]
      )} />
      
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
            {subtitle && (
              <p className="mt-1 text-xs text-gray-400">{subtitle}</p>
            )}
          </div>
          <div className={cn(
            'flex h-12 w-12 items-center justify-center rounded-lg',
            bgClasses[color]
          )}>
            <Icon className={cn(
              'h-6 w-6',
              color === 'red' && 'text-red-500',
              color === 'orange' && 'text-orange-500',
              color === 'yellow' && 'text-yellow-500',
              color === 'green' && 'text-green-500',
              color === 'blue' && 'text-blue-500'
            )} />
          </div>
        </div>
        
        {trend && (
          <div className="mt-4 flex items-center text-sm">
            <span className={cn(
              'font-medium',
              trend.isUp ? 'text-green-500' : 'text-red-500'
            )}>
              {trend.isUp ? '↑' : '↓'} {Math.abs(trend.value)}%
            </span>
            <span className="ml-2 text-gray-400">较昨日</span>
          </div>
        )}
      </div>
    </div>
  );
}
