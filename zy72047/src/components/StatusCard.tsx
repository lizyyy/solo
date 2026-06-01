import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Trophy, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from '@/hooks/useNumberAnimation';

type StatusType = 'resource' | 'score' | 'risk';

interface StatusCardProps {
  type: StatusType;
  value: number;
  previousValue?: number | null;
  label?: string;
  className?: string;
}

const statusConfig = {
  resource: {
    icon: Coins,
    label: '资源',
    color: 'text-gold-400',
    bgColor: 'bg-gold-500/10',
    borderColor: 'border-gold-500/30',
    gradientFrom: 'from-gold-500/20',
    gradientTo: 'to-transparent',
  },
  score: {
    icon: Trophy,
    label: '分数',
    color: 'text-gold-300',
    bgColor: 'bg-gold-400/10',
    borderColor: 'border-gold-400/30',
    gradientFrom: 'from-gold-400/20',
    gradientTo: 'to-transparent',
  },
  risk: {
    icon: AlertTriangle,
    label: '风险',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    gradientFrom: 'from-amber-500/20',
    gradientTo: 'to-transparent',
  },
};

export default function StatusCard({
  type,
  value,
  previousValue = null,
  label,
  className,
}: StatusCardProps) {
  const config = statusConfig[type];
  const [delta, setDelta] = useState<number | null>(null);
  const [showDelta, setShowDelta] = useState(false);

  useEffect(() => {
    if (previousValue === null || value === previousValue) {
      setShowDelta(false);
      return;
    }

    setDelta(value - previousValue);
    setShowDelta(true);

    const timer = setTimeout(() => {
      setShowDelta(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [value, previousValue]);

  const isNegative = value < 0;
  const deltaIsPositive = delta !== null && delta > 0;
  const deltaIsNegative = delta !== null && delta < 0;

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'relative overflow-hidden rounded-xl border p-5 shadow-vinyl',
        'bg-gradient-to-br',
        config.gradientFrom,
        config.gradientTo,
        config.bgColor,
        config.borderColor,
        isNegative && 'border-red-500/50 bg-red-500/10',
        className
      )}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-gold-500/5 to-transparent rounded-full -translate-y-1/2 translate-x-1/2" />

      <div className="relative flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <config.icon className={cn('w-5 h-5', config.color)} />
            <span className="text-sm font-medium text-vinyl-300">
              {label || config.label}
            </span>
          </div>

          <div className="flex items-baseline gap-2">
            <AnimatedNumber
              value={value}
              className={cn(
                'text-3xl font-bold font-mono tabular-nums',
                isNegative ? 'text-red-400' : config.color
              )}
              duration={600}
            />

            <AnimatePresence>
              {showDelta && delta !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.8 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.8 }}
                  className="flex items-center gap-0.5 text-sm font-medium"
                >
                  {deltaIsPositive ? (
                    <TrendingUp className="w-4 h-4 text-green-400" />
                  ) : deltaIsNegative ? (
                    <TrendingDown className="w-4 h-4 text-red-400" />
                  ) : null}
                  <span
                    className={cn(
                      deltaIsPositive && 'text-green-400',
                      deltaIsNegative && 'text-red-400'
                    )}
                  >
                    {deltaIsPositive ? '+' : ''}
                    {delta}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {isNegative && (
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
            className="p-2 rounded-lg bg-red-500/20 animate-pulse-border"
          >
            <AlertTriangle className="w-5 h-5 text-red-400" />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
