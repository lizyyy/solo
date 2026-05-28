import { forwardRef, HTMLAttributes, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'dark' | 'light';
}

export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ children, className = '', variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-white/5 backdrop-blur-xl border border-white/10',
      dark: 'bg-black/30 backdrop-blur-xl border border-white/5',
      light: 'bg-white/10 backdrop-blur-xl border border-white/20'
    };

    return (
      <div
        ref={ref}
        className={twMerge(
          'rounded-2xl shadow-2xl',
          variants[variant],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = 'GlassCard';
