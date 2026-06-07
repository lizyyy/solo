import { useEffect, useState } from 'react';

interface StatCardProps {
  title: string;
  value: number;
  color: 'success' | 'warning' | 'supplement' | 'primary';
  icon: React.ReactNode;
  subtitle?: string;
}

const colorClasses = {
  success: {
    bg: 'bg-success-50',
    border: 'border-success-200',
    text: 'text-success-600',
    iconBg: 'bg-success-100',
    hover: 'hover:border-success-300',
  },
  warning: {
    bg: 'bg-warning-50',
    border: 'border-warning-200',
    text: 'text-warning-600',
    iconBg: 'bg-warning-100',
    hover: 'hover:border-warning-300',
  },
  supplement: {
    bg: 'bg-supplement-50',
    border: 'border-supplement-200',
    text: 'text-supplement-600',
    iconBg: 'bg-supplement-100',
    hover: 'hover:border-supplement-300',
  },
  primary: {
    bg: 'bg-primary-50',
    border: 'border-primary-200',
    text: 'text-primary-600',
    iconBg: 'bg-primary-100',
    hover: 'hover:border-primary-300',
  },
};

export function StatCard({ title, value, color, icon, subtitle }: StatCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const colors = colorClasses[color];

  useEffect(() => {
    let start = 0;
    const duration = 800;
    const increment = value / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value]);

  return (
    <div
      className={`${colors.bg} ${colors.border} ${colors.hover} border rounded-xl p-5 transition-all duration-300 hover:shadow-md cursor-default`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-600 font-medium mb-1">{title}</p>
          <p className={`text-3xl font-bold ${colors.text}`}>{displayValue}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-2">{subtitle}</p>}
        </div>
        <div className={`${colors.iconBg} p-3 rounded-lg`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
