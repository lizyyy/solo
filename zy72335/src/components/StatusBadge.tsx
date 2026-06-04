import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'pending'

const variantStyles: Record<Variant, string> = {
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-rose-100 text-rose-700',
  info: 'bg-blue-100 text-blue-700',
  pending: 'bg-gray-100 text-gray-600',
}

interface StatusBadgeProps {
  variant: Variant
  children: ReactNode
  className?: string
}

export default function StatusBadge({ variant, children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', variantStyles[variant], className)}
    >
      {children}
    </span>
  )
}
