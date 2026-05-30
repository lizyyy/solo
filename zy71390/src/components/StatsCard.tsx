import { LucideIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  trend?: number;
  color?: string;
}

const colorClasses: Record<string, string> = {
  red: 'border-l-red-500',
  orange: 'border-l-orange-500',
  blue: 'border-l-blue-500',
  green: 'border-l-green-500',
  gray: 'border-l-gray-500',
};

function StatsCard({ title, value, icon: Icon, trend, color = 'blue' }: StatsCardProps) {
  return (
    <div
      className={cn(
        'bg-gray-800 rounded-lg p-6 border-l-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-default',
        colorClasses[color] || colorClasses.blue
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-400 text-sm font-medium">{title}</p>
          <p className="text-3xl font-bold text-white mt-2">{value}</p>
          {trend !== undefined && (
            <div className="flex items-center mt-2">
              <span
                className={cn(
                  'text-sm font-medium',
                  trend >= 0 ? 'text-green-400' : 'text-red-400'
                )}
              >
                {trend >= 0 ? '+' : ''}{trend}%
              </span>
              <span className="text-gray-500 text-sm ml-2">较上周</span>
            </div>
          )}
        </div>
        <div className="p-3 bg-gray-700 rounded-lg">
          <Icon className="w-6 h-6 text-gray-300" />
        </div>
      </div>
    </div>
  );
}

export { StatsCard };
