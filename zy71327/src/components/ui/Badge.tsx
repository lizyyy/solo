import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import type { LicenseStatus, Severity } from '@/types';
import { STATUS_LABELS } from '@/types';

type BadgeVariant = LicenseStatus | Severity | 'default';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  pulse?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  active: 'bg-[#4A7C59]/10 text-[#4A7C59] border-[#4A7C59]/20',
  expiring: 'bg-[#D4883A]/10 text-[#D4883A] border-[#D4883A]/20',
  expired: 'bg-[#B85450]/10 text-[#B85450] border-[#B85450]/20',
  incomplete: 'bg-[#B85450]/10 text-[#B85450] border-[#B85450]/20',
  error: 'bg-[#B85450]/10 text-[#B85450] border-[#B85450]/20',
  warning: 'bg-[#D4883A]/10 text-[#D4883A] border-[#D4883A]/20',
  info: 'bg-[#6B8E9F]/10 text-[#6B8E9F] border-[#6B8E9F]/20',
  default: 'bg-gray-100 text-gray-600 border-gray-200',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', pulse = false, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border',
          variantStyles[variant],
          pulse && 'animate-pulse',
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

interface StatusBadgeProps extends Omit<BadgeProps, 'variant'> {
  status: LicenseStatus;
}

export const StatusBadge = forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, pulse, ...props }, ref) => {
    const shouldPulse = pulse || status === 'expiring' || status === 'expired';
    return (
      <Badge ref={ref} variant={status} pulse={shouldPulse} {...props}>
        {STATUS_LABELS[status]}
      </Badge>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';
