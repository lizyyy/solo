import { TrendingUp } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: 'green' | 'blue' | 'orange' | 'red';
  trend?: string;
}

const colorMap = {
  green: 'bg-risk-low/10 text-risk-low',
  blue: 'bg-primary-100 text-primary-700',
  orange: 'bg-risk-medium/10 text-risk-medium',
  red: 'bg-risk-high/10 text-risk-high',
};

export function StatsCard({ title, value, icon, color, trend }: StatsCardProps) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-2 text-sm text-risk-low">
              <TrendingUp className="w-4 h-4" />
              <span>{trend}</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${colorMap[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
