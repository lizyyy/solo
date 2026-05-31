import { twMerge } from 'tailwind-merge';

interface BadgeProps {
  variant?: 'confirmed' | 'pending' | 'manual' | 'anomaly' | 'default';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'default', children, className }: BadgeProps) {
  const baseClass = 'badge';
  const variantClasses = {
    confirmed: 'badge-confirmed',
    pending: 'badge-pending',
    manual: 'badge-manual',
    anomaly: 'badge-anomaly',
    default: 'bg-bg-tertiary text-text-secondary border-border-primary',
  };

  return (
    <span className={twMerge(baseClass, variantClasses[variant], className)}>
      {children}
    </span>
  );
}
