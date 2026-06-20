import React from 'react';
import { cn } from '@/lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    'bg-[#1a365d] text-white border border-[#1a365d] hover:bg-[#2c5282] hover:shadow-[0_0_12px_rgba(26,54,93,0.4)] focus:ring-2 focus:ring-[#1a365d]/50',
  secondary:
    'bg-transparent text-[#e2e8f0] border border-[#4a5568] hover:bg-[#2d3748] hover:border-[#718096] focus:ring-2 focus:ring-[#4a5568]/50',
  danger:
    'bg-[#c53030] text-white border border-[#c53030] hover:bg-[#e53e3e] hover:shadow-[0_0_12px_rgba(197,48,48,0.4)] focus:ring-2 focus:ring-[#c53030]/50',
  warning:
    'bg-[#dd6b20] text-white border border-[#dd6b20] hover:bg-[#ed8936] hover:shadow-[0_0_12px_rgba(221,107,32,0.4)] focus:ring-2 focus:ring-[#dd6b20]/50',
  ghost:
    'bg-transparent text-[#a0aec0] border border-transparent hover:bg-[#2d3748]/50 hover:text-white focus:ring-2 focus:ring-[#4a5568]/30',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...props
}) => {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 font-mono tracking-wide rounded transition-all duration-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none',
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg
          className="animate-spin h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {!loading && icon}
      {children}
    </button>
  );
};
