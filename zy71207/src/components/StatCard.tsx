import { ReactNode } from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  color?: 'blue' | 'green' | 'red' | 'amber' | 'gray';
  trend?: {
    value: number;
    label: string;
  };
}

export function StatCard({ title, value, icon, color = 'blue', trend }: StatCardProps) {
  const colorClasses = {
    blue: 'from-blue-600/20 to-blue-900/10 border-blue-500/30',
    green: 'from-emerald-600/20 to-emerald-900/10 border-emerald-500/30',
    red: 'from-red-600/20 to-red-900/10 border-red-500/30',
    amber: 'from-amber-600/20 to-amber-900/10 border-amber-500/30',
    gray: 'from-gray-600/20 to-gray-900/10 border-gray-500/30',
  };

  const iconColorClasses = {
    blue: 'text-blue-400',
    green: 'text-emerald-400',
    red: 'text-red-400',
    amber: 'text-amber-400',
    gray: 'text-gray-400',
  };

  return (
    <div className={`stat-card bg-gradient-to-br ${colorClasses[color]} animate-slide-up`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-dark-muted mb-1">{title}</p>
          <p className="text-3xl font-bold font-mono text-white">{value}</p>
          {trend && (
            <p
              className={`text-xs mt-2 ${trend.value > 0 ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {trend.value > 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-dark-bg/50 ${iconColorClasses[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
