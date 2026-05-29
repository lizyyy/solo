import { ReactNode } from 'react';

interface CardProps {
  title: string;
  value: number | string;
  icon: ReactNode;
  color: 'green' | 'blue' | 'orange' | 'red';
  trend?: string;
  children?: ReactNode;
}

const colorMap = {
  green: 'bg-risk-low/10 text-risk-low',
  blue: 'bg-primary-100 text-primary-700',
  orange: 'bg-risk-medium/10 text-risk-medium',
  red: 'bg-risk-high/10 text-risk-high',
};

export function Card({ title, value, icon, color, trend }: CardProps) {
  return (
    <div className="card">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {trend && (
            <p className="text-sm text-gray-400 mt-2">{trend}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${colorMap[color]}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
