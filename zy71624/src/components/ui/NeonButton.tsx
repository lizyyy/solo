import { ButtonHTMLAttributes, forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

type NeonButtonColor = 'purple' | 'cyan' | 'green' | 'red' | 'orange' | 'pink' | 'yellow';
type NeonButtonVariant = 'solid' | 'outline';

interface NeonButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  color?: NeonButtonColor;
  variant?: NeonButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
}

const colorStyles: Record<NeonButtonColor, { solid: string; outline: string; shadow: string }> = {
  purple: {
    solid: 'bg-neon-purple border-neon-purple text-white hover:bg-neon-purple/80',
    outline: 'border-neon-purple hover:bg-neon-purple/20 text-neon-purple hover:text-white',
    shadow: 'shadow-neon-purple',
  },
  cyan: {
    solid: 'bg-neon-cyan border-neon-cyan text-white hover:bg-neon-cyan/80',
    outline: 'border-neon-cyan hover:bg-neon-cyan/20 text-neon-cyan hover:text-white',
    shadow: 'shadow-neon-cyan',
  },
  green: {
    solid: 'bg-neon-green border-neon-green text-white hover:bg-neon-green/80',
    outline: 'border-neon-green hover:bg-neon-green/20 text-neon-green hover:text-white',
    shadow: 'shadow-neon-green',
  },
  red: {
    solid: 'bg-neon-red border-neon-red text-white hover:bg-neon-red/80',
    outline: 'border-neon-red hover:bg-neon-red/20 text-neon-red hover:text-white',
    shadow: 'shadow-neon-red',
  },
  orange: {
    solid: 'bg-neon-orange border-neon-orange text-white hover:bg-neon-orange/80',
    outline: 'border-neon-orange hover:bg-neon-orange/20 text-neon-orange hover:text-white',
    shadow: 'shadow-neon-orange',
  },
  pink: {
    solid: 'bg-neon-pink border-neon-pink text-white hover:bg-neon-pink/80',
    outline: 'border-neon-pink hover:bg-neon-pink/20 text-neon-pink hover:text-white',
    shadow: 'shadow-neon-pink',
  },
  yellow: {
    solid: 'bg-neon-yellow border-neon-yellow text-white hover:bg-neon-yellow/80',
    outline: 'border-neon-yellow hover:bg-neon-yellow/20 text-neon-yellow hover:text-white',
    shadow: 'shadow-neon-yellow',
  },
};

const sizeStyles: Record<string, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-6 py-2.5 text-sm',
  lg: 'px-8 py-3.5 text-base',
};

export const NeonButton = forwardRef<HTMLButtonElement, NeonButtonProps>(
  ({ className, color = 'purple', variant = 'solid', size = 'md', glow = true, children, ...props }, ref) => {
    return (
      <motion.button
        ref={ref}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          'relative font-display font-semibold uppercase tracking-wider',
          'border-2 rounded-lg',
          'transition-all duration-300 ease-out',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
          colorStyles[color][variant],
          glow && `hover:${colorStyles[color].shadow}`,
          sizeStyles[size],
          className
        )}
        {...props}
      >
        <motion.span className="relative z-10 flex items-center justify-center">{children}</motion.span>
      </motion.button>
    );
  }
);

NeonButton.displayName = 'NeonButton';
