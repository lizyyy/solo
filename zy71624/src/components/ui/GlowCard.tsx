import { forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

type GlowCardColor = 'purple' | 'cyan' | 'green' | 'red' | 'orange' | 'default';

interface GlowCardProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  color?: GlowCardColor;
  animated?: boolean;
}

const colorStyles: Record<GlowCardColor, string> = {
  purple: 'border-neon-purple/50 hover:border-neon-purple shadow-neon-purple/20 hover:shadow-neon-purple/40',
  cyan: 'border-neon-cyan/50 hover:border-neon-cyan shadow-neon-cyan/20 hover:shadow-neon-cyan/40',
  green: 'border-neon-green/50 hover:border-neon-green shadow-neon-green/20 hover:shadow-neon-green/40',
  red: 'border-neon-red/50 hover:border-neon-red shadow-neon-red/20 hover:shadow-neon-red/40',
  orange: 'border-neon-orange/50 hover:border-neon-orange shadow-neon-orange/20 hover:shadow-neon-orange/40',
  default: 'border-neon-purple/30 hover:border-neon-purple/50 shadow-neon-purple/10 hover:shadow-neon-purple/20',
};

export const GlowCard = forwardRef<HTMLDivElement, GlowCardProps>(
  ({ className, color = 'default', animated = true, children, onDrag, onDragStart, onDragEnd, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={animated ? { opacity: 0, y: 20 } : undefined}
        animate={animated ? { opacity: 1, y: 0 } : undefined}
        transition={{ duration: 0.3 }}
        className={cn(
          'glass-card rounded-xl p-4 border',
          'transition-all duration-300 ease-out',
          colorStyles[color],
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

GlowCard.displayName = 'GlowCard';
