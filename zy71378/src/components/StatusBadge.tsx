import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  type: 'signature' | 'processing' | 'confirm' | 'replay' | 'order'
}

const colorSchemes: Record<string, Record<string, string>> = {
  signature: {
    valid: 'bg-[var(--color-emerald)]/15 text-[var(--color-emerald)]',
    expired: 'bg-[var(--color-amber)]/15 text-[var(--color-amber)]',
    invalid: 'bg-[var(--color-red)]/15 text-[var(--color-red)]',
    pending: 'bg-[var(--color-blue)]/15 text-[var(--color-blue)]',
  },
  processing: {
    success: 'bg-[var(--color-emerald)]/15 text-[var(--color-emerald)]',
    failed: 'bg-[var(--color-red)]/15 text-[var(--color-red)]',
    duplicate: 'bg-[var(--color-amber)]/15 text-[var(--color-amber)]',
    pending: 'bg-[var(--color-blue)]/15 text-[var(--color-blue)]',
  },
  confirm: {
    confirmed: 'bg-[var(--color-emerald)]/15 text-[var(--color-emerald)]',
    pending: 'bg-[var(--color-amber)]/15 text-[var(--color-amber)]',
    rejected: 'bg-[var(--color-red)]/15 text-[var(--color-red)]',
  },
  replay: {
    queued: 'bg-[var(--color-blue)]/15 text-[var(--color-blue)]',
    running: 'bg-[var(--color-purple)]/15 text-[var(--color-purple)]',
    completed: 'bg-[var(--color-emerald)]/15 text-[var(--color-emerald)]',
    failed: 'bg-[var(--color-red)]/15 text-[var(--color-red)]',
  },
  order: {
    pending: 'bg-[var(--color-blue)]/15 text-[var(--color-blue)]',
    paid: 'bg-[var(--color-emerald)]/15 text-[var(--color-emerald)]',
    failed: 'bg-[var(--color-red)]/15 text-[var(--color-red)]',
    refunded: 'bg-[var(--color-amber)]/15 text-[var(--color-amber)]',
    cancelled: 'bg-[var(--color-text-secondary)]/15 text-[var(--color-text-secondary)]',
  },
}

export default function StatusBadge({ status, type }: StatusBadgeProps) {
  const colorClass = colorSchemes[type]?.[status] ?? 'bg-[var(--color-text-secondary)]/15 text-[var(--color-text-secondary)]'

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium whitespace-nowrap',
        colorClass
      )}
    >
      {status}
    </span>
  )
}
