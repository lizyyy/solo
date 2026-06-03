import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'warning' | 'success' | 'danger' | 'info';
  className?: string;
}

export default function Badge({ children, variant = 'default', className }: BadgeProps) {
  const variantClasses = {
    default: 'bg-primary-700 text-primary-200 border-primary-500',
    warning: 'bg-accent-warning/20 text-accent-warning border-accent-warning/50',
    success: 'bg-accent-success/20 text-accent-success border-accent-success/50',
    danger: 'bg-red-900/50 text-red-300 border-red-500/50',
    info: 'bg-accent-info/20 text-accent-info border-accent-info/50'
  };

  return (
    <span className={cn(
      'inline-flex items-center px-2 py-1 text-xs font-mono border tracking-wider',
      variantClasses[variant],
      className
    )}>
      {children}
    </span>
  );
}
