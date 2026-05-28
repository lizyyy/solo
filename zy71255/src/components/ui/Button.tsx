import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  children?: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  type?: 'button' | 'submit' | 'reset';
  [key: string]: unknown;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-accent-green text-primary-400 font-semibold
    hover:bg-accent-green/90 hover:shadow-glow-green
    active:bg-accent-green/80
  `,
  secondary: `
    bg-white/10 text-white border border-white/20
    hover:bg-white/15 hover:border-accent-cyan/50
    active:bg-white/20
  `,
  ghost: `
    bg-transparent text-white
    hover:bg-white/10 hover:text-accent-cyan
    active:bg-white/15
  `,
  danger: `
    bg-accent-red text-white font-semibold
    hover:bg-accent-red/90 hover:shadow-glow-red
    active:bg-accent-red/80
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5',
  md: 'px-5 py-2.5 text-base gap-2',
  lg: 'px-7 py-3.5 text-lg gap-2.5',
};

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  className,
  onClick,
  type = 'button',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const motionProps = {
    whileHover: !isDisabled ? { scale: 1.02 } : undefined,
    whileTap: !isDisabled ? { scale: 0.98 } : undefined,
    animate: !isDisabled && variant === 'primary' ? {
      boxShadow: [
        '0 0 0 rgba(0, 255, 157, 0)',
        '0 0 20px rgba(0, 255, 157, 0.3)',
        '0 0 0 rgba(0, 255, 157, 0)',
      ],
    } : undefined,
    transition: !isDisabled && variant === 'primary' ? {
      boxShadow: {
        duration: 2,
        repeat: Infinity,
        ease: 'easeInOut',
      },
    } : undefined,
  };

  return (
    <motion.button
      {...motionProps}
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      className={cn(
        'relative inline-flex items-center justify-center',
        'rounded-xl font-medium transition-all duration-300',
        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-primary-400',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100',
        'overflow-hidden',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...rest}
    >
      <div
        className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-300"
        style={{
          background: 'linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.3) 50%, transparent 70%)',
          transform: 'translateX(-100%)',
          animation: !isDisabled ? 'shimmer 3s infinite' : 'none',
        }}
      />

      {loading && (
        <Loader2 className="w-4 h-4 animate-spin" />
      )}

      {!loading && icon && iconPosition === 'left' && (
        <span className="flex-shrink-0">{icon}</span>
      )}

      <span className="relative z-10">{children}</span>

      {!loading && icon && iconPosition === 'right' && (
        <span className="flex-shrink-0">{icon}</span>
      )}

      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </motion.button>
  );
}
