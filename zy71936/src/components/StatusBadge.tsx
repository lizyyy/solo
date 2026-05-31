import { cn } from '@/lib/utils'
import type { MarkStatus } from '@/lib/types'

const STATUS_STYLES: Record<MarkStatus, string> = {
  待判断: 'bg-zinc-700 text-zinc-300',
  已确认: 'bg-emerald-900/60 text-emerald-400 border border-emerald-700/50',
  待复核: 'bg-sky-900/60 text-sky-400 border border-sky-700/50',
  授权过期: 'bg-amber-900/60 text-amber-400 border border-amber-700/50',
}

interface StatusBadgeProps {
  status: MarkStatus
  className?: string
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-0.5 text-xs font-medium',
        STATUS_STYLES[status],
        className,
      )}
    >
      {status}
    </span>
  )
}
