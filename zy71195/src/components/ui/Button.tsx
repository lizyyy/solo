import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-slate-700 hover:bg-slate-600 text-white border-slate-600',
  secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700',
  success: 'bg-green-700 hover:bg-green-600 text-white border-green-600',
  danger: 'bg-red-700 hover:bg-red-600 text-white border-red-600',
  warning: 'bg-orange-600 hover:bg-orange-500 text-white border-orange-500',
  ghost: 'bg-transparent hover:bg-slate-800 text-slate-300 border-transparent',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
  xl: 'px-8 py-4 text-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-mono font-semibold border-2',
          'transition-all duration-150 uppercase tracking-wider',
          'active:translate-y-0.5 active:shadow-inner',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:active:translate-y-0',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
