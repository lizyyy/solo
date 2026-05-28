import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface DataCardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: number;
  icon?: React.ReactNode;
  status?: 'normal' | 'warning' | 'danger';
  className?: string;
}

export function DataCard({
  title,
  value,
  unit,
  change,
  icon,
  status = 'normal',
  className,
}: DataCardProps) {
  const statusColors = {
    normal: 'border-navy-600',
    warning: 'border-yellow-500/50',
    danger: 'border-liquidity-danger/50 pulse-warning',
  };

  const changeColor = change && change >= 0 ? 'text-liquidity-good' : 'text-liquidity-danger';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'bg-navy-800/50 backdrop-blur-sm rounded-xl p-4 border',
        statusColors[status],
        className
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-navy-300">{title}</span>
        {icon && <span className="text-gold-400">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <motion.span 
          key={value}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-2xl font-bold font-mono text-gold-400"
        >
          {typeof value === 'number' ? value.toLocaleString() : value}
        </motion.span>
        {unit && <span className="text-sm text-navy-400">{unit}</span>}
      </div>
      {change !== undefined && (
        <div className={cn('text-xs mt-1 font-mono', changeColor)}>
          {change >= 0 ? '↑' : '↓'} {Math.abs(change).toFixed(2)}
        </div>
      )}
    </motion.div>
  );
}
