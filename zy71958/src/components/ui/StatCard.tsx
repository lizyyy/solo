import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: ReactNode;
  color: 'yellow' | 'green' | 'orange' | 'red' | 'blue';
  trend?: number;
  className?: string;
}

const colorClasses: Record<string, { bg: string; border: string; icon: string; text: string }> = {
  yellow: {
    bg: 'bg-gradient-to-br from-yellow-500/10 to-yellow-600/5',
    border: 'border-yellow-500/30',
    icon: 'text-yellow-400',
    text: 'text-yellow-300',
  },
  green: {
    bg: 'bg-gradient-to-br from-green-500/10 to-green-600/5',
    border: 'border-green-500/30',
    icon: 'text-green-400',
    text: 'text-green-300',
  },
  orange: {
    bg: 'bg-gradient-to-br from-orange-500/10 to-orange-600/5',
    border: 'border-orange-500/30',
    icon: 'text-orange-400',
    text: 'text-orange-300',
  },
  red: {
    bg: 'bg-gradient-to-br from-red-500/10 to-red-600/5',
    border: 'border-red-500/30',
    icon: 'text-red-400',
    text: 'text-red-300',
  },
  blue: {
    bg: 'bg-gradient-to-br from-blue-500/10 to-blue-600/5',
    border: 'border-blue-500/30',
    icon: 'text-blue-400',
    text: 'text-blue-300',
  },
};

export function StatCard({ title, value, icon, color, trend, className }: StatCardProps) {
  const colors = colorClasses[color] || colorClasses.blue;

  return (
    <div
      className={cn(
        'p-4 rounded-lg border backdrop-blur-sm transition-all duration-300 hover:scale-[1.02]',
        colors.bg,
        colors.border,
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-400 mb-1">{title}</p>
          <p className={cn('text-2xl font-bold', colors.text)}>{value}</p>
          {trend !== undefined && (
            <p className={`text-xs mt-1 ${trend >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </p>
          )}
        </div>
        <div className={cn('p-2 rounded-lg bg-slate-800/50', colors.icon)}>{icon}</div>
      </div>
    </div>
  );
}
