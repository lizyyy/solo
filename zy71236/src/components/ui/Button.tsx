import { ButtonHTMLAttributes, forwardRef } from 'react';
import { twMerge } from 'tailwind-merge';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  active?: boolean;
  glow?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', active = false, glow = false, ...props }, ref) => {
    const baseClasses =
      'relative inline-flex items-center justify-center font-medium tracking-wider transition-all duration-200 rounded-lg border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed';

    const variantClasses: Record<ButtonVariant, string> = {
      primary:
        'bg-cyan-500/10 border-cyan-500 text-cyan-400 hover:bg-cyan-500/20 hover:border-cyan-400 focus:ring-cyan-500/50',
      secondary:
        'bg-gray-800/50 border-gray-600 text-gray-300 hover:bg-gray-700/50 hover:border-gray-500 focus:ring-gray-500/50',
      danger:
        'bg-red-500/10 border-red-500 text-red-400 hover:bg-red-500/20 hover:border-red-400 focus:ring-red-500/50',
      warning:
        'bg-orange-500/10 border-orange-500 text-orange-400 hover:bg-orange-500/20 hover:border-orange-400 focus:ring-orange-500/50',
      ghost:
        'bg-transparent border-transparent text-gray-400 hover:bg-gray-800/50 hover:text-gray-200 focus:ring-gray-500/50',
    };

    const activeClasses: Record<ButtonVariant, string> = {
      primary:
        'bg-cyan-500/30 border-cyan-400 text-cyan-300 shadow-lg shadow-cyan-500/30',
      secondary:
        'bg-gray-700/70 border-gray-400 text-gray-200',
      danger:
        'bg-red-500/30 border-red-400 text-red-300',
      warning:
        'bg-orange-500/30 border-orange-400 text-orange-300',
      ghost:
        'bg-gray-800/70 text-gray-200',
    };

    const sizeClasses: Record<ButtonSize, string> = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base',
    };

    const glowClasses = glow
      ? {
          primary: 'shadow-lg shadow-cyan-500/30',
          secondary: 'shadow-lg shadow-gray-500/20',
          danger: 'shadow-lg shadow-red-500/30',
          warning: 'shadow-lg shadow-orange-500/30',
          ghost: '',
        }[variant]
      : '';

    return (
      <button
        ref={ref}
        className={twMerge(
          baseClasses,
          active ? activeClasses[variant] : variantClasses[variant],
          sizeClasses[size],
          glowClasses,
          className
        )}
        {...props}
      >
        {props.children}
      </button>
    );
  }
);

Button.displayName = 'Button';
