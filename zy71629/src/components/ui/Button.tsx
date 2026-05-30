import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'brass';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  className,
  variant = 'primary',
  size = 'md',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-jazz-bg disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-jazz-gold text-jazz-bg hover:bg-jazz-goldLight focus:ring-jazz-gold/50',
    secondary: 'bg-jazz-bgLight text-jazz-text hover:bg-jazz-border focus:ring-jazz-border/50 border border-jazz-border',
    ghost: 'bg-transparent text-jazz-text hover:bg-jazz-bgLight focus:ring-jazz-border/30',
    danger: 'bg-jazz-burgundy text-white hover:bg-jazz-burgundyLight focus:ring-jazz-burgundy/50',
    brass: 'btn-brass',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    icon: 'p-2 w-9 h-9',
  };

  return (
    <button
      className={cn(
        baseStyles,
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
};
