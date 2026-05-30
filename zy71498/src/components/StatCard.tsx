import { ReactNode, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number;
  icon: ReactNode;
  color: 'purple' | 'red' | 'green' | 'yellow' | 'blue';
  trend?: { value: number; isPositive: boolean };
  delay?: number;
  className?: string;
}

const colorGradients = {
  purple: 'from-neon-purple-600/20 to-neon-purple-800/20 border-neon-purple-500/30',
  red: 'from-coral-red-600/20 to-coral-red-800/20 border-coral-red-500/30',
  green: 'from-emerald-green-600/20 to-emerald-green-800/20 border-emerald-green-500/30',
  yellow: 'from-amber-yellow-600/20 to-amber-yellow-800/20 border-amber-yellow-500/30',
  blue: 'from-deep-blue-500/20 to-deep-blue-700/20 border-deep-blue-400/30',
};

const colorText = {
  purple: 'text-neon-purple-400',
  red: 'text-coral-red-400',
  green: 'text-emerald-green-400',
  yellow: 'text-amber-yellow-400',
  blue: 'text-deep-blue-300',
};

const colorIconBg = {
  purple: 'bg-neon-purple-500/20 text-neon-purple-400',
  red: 'bg-coral-red-500/20 text-coral-red-400',
  green: 'bg-emerald-green-500/20 text-emerald-green-400',
  yellow: 'bg-amber-yellow-500/20 text-amber-yellow-400',
  blue: 'bg-deep-blue-500/20 text-deep-blue-300',
};

export default function StatCard({ title, value, icon, color, trend, delay = 0, className }: StatCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (!isVisible) return;

    const duration = 1000;
    const steps = 30;
    const stepValue = value / steps;
    let current = 0;

    const interval = setInterval(() => {
      current += stepValue;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(interval);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(interval);
  }, [value, isVisible]);

  return (
    <div
      className={cn(
        'card-gradient p-6 border bg-gradient-to-br transition-all duration-500',
        colorGradients[color],
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-deep-blue-300 text-sm font-medium mb-1">{title}</p>
          <p className={cn('text-3xl font-display font-bold', colorText[color])}>
            {displayValue.toLocaleString()}
          </p>
          {trend && (
            <div className="mt-2 flex items-center text-sm">
              <span className={cn(
                'font-medium',
                trend.isPositive ? 'text-emerald-green-400' : 'text-coral-red-400'
              )}>
                {trend.isPositive ? '↑' : '↓'} {trend.value}%
              </span>
              <span className="text-deep-blue-400 ml-1">较上周</span>
            </div>
          )}
        </div>
        <div className={cn('p-3 rounded-lg', colorIconBg[color])}>
          {icon}
        </div>
      </div>
    </div>
  );
}
