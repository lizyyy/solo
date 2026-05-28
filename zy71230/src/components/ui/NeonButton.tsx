import { forwardRef, ButtonHTMLAttributes } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type NeonButtonVariant = 'primary' | 'secondary' | 'warning' | 'danger' | 'success';
type NeonButtonSize = 'sm' | 'md' | 'lg';

interface NeonButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: NeonButtonVariant;
  size?: NeonButtonSize;
  loading?: boolean;
}

const variantStyles: Record<NeonButtonVariant, string> = {
  primary: 'border-neon-pink text-neon-pink hover:bg-neon-pink hover:text-rock-dark hover:shadow-neon-pink',
  secondary: 'border-neon-cyan text-neon-cyan hover:bg-neon-cyan hover:text-rock-dark hover:shadow-neon-cyan',
  warning: 'border-warning-orange text-warning-orange hover:bg-warning-orange hover:text-rock-dark hover:shadow-neon-orange',
  danger: 'border-danger-red text-danger-red hover:bg-danger-red hover:text-rock-dark',
  success: 'border-success-green text-success-green hover:bg-success-green hover:text-rock-dark',
};

const sizeStyles: Record<NeonButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-base',
  lg: 'px-7 py-3.5 text-lg',
};

const variantGlow: Record<NeonButtonVariant, string> = {
  primary: '0 0 10px #e94560, 0 0 30px rgba(233, 69, 96, 0.6)',
  secondary: '0 0 10px #00d4ff, 0 0 30px rgba(0, 212, 255, 0.6)',
  warning: '0 0 10px #ff9a3c, 0 0 30px rgba(255, 154, 60, 0.6)',
  danger: '0 0 10px #ef4444, 0 0 30px rgba(239, 68, 68, 0.6)',
  success: '0 0 10px #4ade80, 0 0 30px rgba(74, 222, 128, 0.6)',
};

const MotionButton = motion.button as unknown as React.ForwardRefExoticComponent<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    whileHover?: unknown;
    whileTap?: unknown;
    animate?: unknown;
    transition?: unknown;
  } & React.RefAttributes<HTMLButtonElement>
>;

const NeonButton = forwardRef<HTMLButtonElement, NeonButtonProps>(
  ({ className, variant = 'primary', size = 'md', disabled, loading, children, onDrag, ...props }, ref) => {
    return (
      <MotionButton
        ref={ref}
        disabled={disabled || loading}
        whileHover={!disabled && !loading ? {
          boxShadow: variantGlow[variant],
          scale: 1.02,
        } : undefined}
        whileTap={!disabled && !loading ? { scale: 0.98 } : undefined}
        animate={!disabled && !loading ? {
          boxShadow: ['0 0 0px transparent', variantGlow[variant], '0 0 0px transparent'],
        } : undefined}
        transition={!disabled && !loading ? {
          boxShadow: {
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          },
          duration: 0.2,
        } : undefined}
        className={cn(
          'relative font-rock uppercase tracking-wider border-2 bg-transparent',
          'transition-all duration-300 rounded-sm',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-rock-dark',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          variantStyles[variant],
          sizeStyles[size],
          loading && 'cursor-wait',
          className
        )}
        {...props}
      >
        <span className={cn('flex items-center justify-center gap-2', loading && 'opacity-0')}>
          {children}
        </span>
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="animate-spin h-5 w-5" />
          </span>
        )}
      </MotionButton>
    );
  }
);

NeonButton.displayName = 'NeonButton';

export default NeonButton;
