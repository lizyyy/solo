import { cn } from '../../lib/utils';
import { CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

type BadgeVariant = 'success' | 'warning' | 'error' | 'info';

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  showIcon?: boolean;
}

const variantConfig: Record<
  BadgeVariant,
  { icon: React.ElementType; className: string }
> = {
  success: {
    icon: CheckCircle,
    className: 'badge badge-success',
  },
  warning: {
    icon: AlertTriangle,
    className: 'badge badge-warning',
  },
  error: {
    icon: XCircle,
    className: 'badge badge-error',
  },
  info: {
    icon: Info,
    className: 'badge badge-info',
  },
};

export default function Badge({
  variant,
  children,
  className,
  showIcon = true,
}: BadgeProps) {
  const config = variantConfig[variant];
  const Icon = config.icon;

  return (
    <span className={cn(config.className, className)}>
      {showIcon && <Icon className="w-3 h-3 mr-1" />}
      {children}
    </span>
  );
}
