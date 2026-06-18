import { cn } from '@/lib/utils'
import type { RecordStatus } from '@/utils/types'
import { STATUS_LABELS } from '@/utils/types'

interface StatusBadgeProps {
  status: RecordStatus
  className?: string
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const variants: Record<RecordStatus, string> = {
    UNCONFIRMED: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    CONFIRMED: 'bg-neon/20 text-neon border-neon/30',
    SUSPENDED: 'bg-alert/20 text-alert border-alert/30 animate-pulse-slow',
    RESOLVED: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border transition-all duration-300',
        variants[status],
        className
      )}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current" />
      {STATUS_LABELS[status]}
    </span>
  )
}
