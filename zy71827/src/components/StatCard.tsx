import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/utils/helpers';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'amber' | 'red' | 'purple';
  trend?: { value: number; isPositive: boolean };
  className?: string;
}

const colorGradients: Record<string, string> = {
  blue: 'from-blue-500 to-sky-600',
  green: 'from-emerald-500 to-teal-600',
  amber: 'from-amber-500 to-orange-600',
  red: 'from-rose-500 to-red-600',
  purple: 'from-violet-500 to-purple-600',
};

const colorBg: Record<string, string> = {
  blue: 'bg-blue-500/10',
  green: 'bg-emerald-500/10',
  amber: 'bg-amber-500/10',
  red: 'bg-rose-500/10',
  purple: 'bg-violet-500/10',
};

const colorText: Record<string, string> = {
  blue: 'text-blue-500',
  green: 'text-emerald-500',
  amber: 'text-amber-500',
  red: 'text-rose-500',
  purple: 'text-violet-500',
};

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const duration = 1000;
    const start = 0;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(start + (value - start) * easeOut));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <span>{display.toLocaleString()}</span>;
}

export default function StatCard({ title, value, icon, color, trend, className }: StatCardProps) {
  const Icon = icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-slate-200 hover:shadow-md transition-shadow',
        className
      )}
    >
      <div className={cn('absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-10 bg-gradient-to-br', colorGradients[color])} />
      
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className={cn('text-3xl font-bold', colorText[color])}>
                <AnimatedNumber value={value} />
              </span>
              {trend && (
                <span className={cn(
                  'inline-flex items-center gap-0.5 text-xs font-medium',
                  trend.isPositive ? 'text-emerald-600' : 'text-rose-600'
                )}>
                  {trend.isPositive ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : trend.value < 0 ? (
                    <TrendingDown className="w-3.5 h-3.5" />
                  ) : (
                    <Minus className="w-3.5 h-3.5" />
                  )}
                  {Math.abs(trend.value)}%
                </span>
              )}
            </div>
          </div>
          
          <div className={cn('p-3 rounded-xl', colorBg[color])}>
            <Icon className={cn('w-6 h-6', colorText[color])} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
