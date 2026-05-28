import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type BorderColor = 'neon-pink' | 'neon-cyan' | 'neon-purple' | 'warning-orange' | 'success-green' | 'danger-red';

interface NeonCardProps {
  children: ReactNode;
  borderColor?: BorderColor;
  glow?: boolean;
  title?: ReactNode;
  subtitle?: ReactNode;
  className?: string;
  contentClassName?: string;
}

const borderColorMap: Record<BorderColor, string> = {
  'neon-pink': 'border-neon-pink',
  'neon-cyan': 'border-neon-cyan',
  'neon-purple': 'border-neon-purple',
  'warning-orange': 'border-warning-orange',
  'success-green': 'border-success-green',
  'danger-red': 'border-danger-red',
};

const glowColorMap: Record<BorderColor, string> = {
  'neon-pink': '0 0 10px #e94560, 0 0 30px rgba(233, 69, 96, 0.4)',
  'neon-cyan': '0 0 10px #00d4ff, 0 0 30px rgba(0, 212, 255, 0.4)',
  'neon-purple': '0 0 10px #9d4edd, 0 0 30px rgba(157, 78, 221, 0.4)',
  'warning-orange': '0 0 10px #ff9a3c, 0 0 30px rgba(255, 154, 60, 0.4)',
  'success-green': '0 0 10px #4ade80, 0 0 30px rgba(74, 222, 128, 0.4)',
  'danger-red': '0 0 10px #ef4444, 0 0 30px rgba(239, 68, 68, 0.4)',
};

const textColorMap: Record<BorderColor, string> = {
  'neon-pink': 'text-neon-pink',
  'neon-cyan': 'text-neon-cyan',
  'neon-purple': 'text-neon-purple',
  'warning-orange': 'text-warning-orange',
  'success-green': 'text-success-green',
  'danger-red': 'text-danger-red',
};

export default function NeonCard({
  children,
  borderColor = 'neon-pink',
  glow = true,
  title,
  subtitle,
  className,
  contentClassName,
}: NeonCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className={cn(
        'relative bg-rock-dark border-2 rounded-sm overflow-hidden',
        borderColorMap[borderColor],
        className
      )}
      style={glow ? {
        boxShadow: glowColorMap[borderColor],
      } : undefined}
    >
      <div
        className="absolute inset-0 opacity-5 pointer-events-none bg-noise"
        style={{ backgroundSize: '200px 200px' }}
      />
      {(title || subtitle) && (
        <div className="px-6 py-4 border-b border-rock-light/30">
          {title && (
            <h3 className={cn('font-rock text-xl uppercase tracking-wider', textColorMap[borderColor])}>
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="mt-1 text-sm text-gray-400">{subtitle}</p>
          )}
        </div>
      )}
      <div className={cn('p-6 relative z-10', contentClassName)}>
        {children}
      </div>
    </motion.div>
  );
}
