import type { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: number;
  icon: ReactNode;
  colorClass?: string;
}

export const StatsCard = ({ title, value, icon, colorClass = 'text-text-secondary' }: StatsCardProps) => {
  return (
    <div className="card p-4 flex items-center gap-4">
      <div className={`p-2 bg-bg-tertiary border border-border-default ${colorClass}`}>
        {icon}
      </div>
      <div>
        <div className="text-2xl font-mono font-semibold text-text-primary">{value}</div>
        <div className="text-xs text-text-secondary">{title}</div>
      </div>
    </div>
  );
};
