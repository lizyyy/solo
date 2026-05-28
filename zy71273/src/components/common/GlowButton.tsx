import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

interface GlowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
}

export const GlowButton = forwardRef<HTMLButtonElement, GlowButtonProps>(
  ({ children, className = '', variant = 'primary', size = 'md', active = false, ...props }, ref) => {
    const variants = {
      primary: 'bg-indigo-500/20 border-indigo-400/30 text-indigo-300 hover:bg-indigo-500/30 hover:border-indigo-400/50 hover:shadow-[0_0_20px_rgba(99,102,241,0.3)]',
      secondary: 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]',
      danger: 'bg-red-500/20 border-red-400/30 text-red-300 hover:bg-red-500/30 hover:border-red-400/50 hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]',
      ghost: 'bg-transparent border-transparent text-white/60 hover:bg-white/5 hover:text-white/80'
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs',
      md: 'px-4 py-2 text-sm',
      lg: 'px-6 py-3 text-base'
    };

    return (
      <button
        ref={ref}
        className={twMerge(
          'inline-flex items-center justify-center gap-2 rounded-xl border font-medium transition-all duration-300',
          'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-indigo-500/50',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none',
          variants[variant],
          sizes[size],
          active && 'ring-2 ring-indigo-400/60 bg-indigo-500/30',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

GlowButton.displayName = 'GlowButton';
