import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { ReactNode } from 'react';

type StatCardColor = 'red' | 'orange' | 'yellow' | 'green' | 'blue' | 'purple' | 'gray';

interface StatCardProps {
  title: string;
  value: number;
  icon: ReactNode;
  color?: StatCardColor;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  highlight?: boolean;
  onClick?: () => void;
}

const colorClasses: Record<StatCardColor, { border: string; bg: string; text: string }> = {
  red: { border: 'border-red-200 hover:border-red-300', bg: 'bg-red-100', text: 'text-red-600' },
  orange: { border: 'border-orange-200 hover:border-orange-300', bg: 'bg-orange-100', text: 'text-orange-600' },
  yellow: { border: 'border-yellow-200 hover:border-yellow-300', bg: 'bg-yellow-100', text: 'text-yellow-600' },
  green: { border: 'border-green-200 hover:border-green-300', bg: 'bg-green-100', text: 'text-green-600' },
  blue: { border: 'border-blue-200 hover:border-blue-300', bg: 'bg-blue-100', text: 'text-blue-600' },
  purple: { border: 'border-purple-200 hover:border-purple-300', bg: 'bg-purple-100', text: 'text-purple-600' },
  gray: { border: 'border-gray-200 hover:border-gray-300', bg: 'bg-gray-100', text: 'text-gray-600' },
};

export function StatCard({
  title,
  value,
  icon,
  color = 'gray',
  trend,
  trendValue,
  highlight = false,
  onClick,
}: StatCardProps) {
  const trendIcon =
    trend === 'up' ? (
      <TrendingUp className="w-4 h-4 text-red-500" />
    ) : trend === 'down' ? (
      <TrendingDown className="w-4 h-4 text-green-500" />
    ) : (
      <Minus className="w-4 h-4 text-gray-500" />
    );

  const colorClass = colorClasses[color];

  return (
    <div
      className={`bg-white rounded-lg border-2 p-4 transition-all hover:shadow-md cursor-pointer ${
        highlight
          ? `border-${color}-500 shadow-${color}-100 shadow-md`
          : colorClass.border
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p
            className="text-3xl font-bold"
            style={{ fontFamily: '"JetBrains Mono", monospace' }}
          >
            {value}
          </p>
          {trendValue && (
            <div className="flex items-center gap-1 mt-2 text-sm">
              {trendIcon}
              <span
                className={
                  trend === 'up'
                    ? 'text-red-500'
                    : trend === 'down'
                    ? 'text-green-500'
                    : 'text-gray-500'
                }
              >
                {trendValue}
              </span>
            </div>
          )}
        </div>
        <div
          className={`p-3 rounded-lg ${
            highlight ? colorClass.bg + ' ' + colorClass.text : 'bg-[#1e3a5f]/10 text-[#1e3a5f]'
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
