import type { RecordStatus } from '@shared/types'
import { STATUS_LABELS } from '@shared/types'
import { cn } from '@/lib/utils'

const statusColors: Record<RecordStatus, string> = {
  pending_review: 'bg-orange-100 text-orange-700 border-orange-300',
  under_review: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  pending_inspection: 'bg-red-100 text-red-700 border-red-300',
  corrected: 'bg-purple-100 text-purple-700 border-purple-300',
  confirmed: 'bg-green-100 text-green-700 border-green-300',
}

const statusDotColors: Record<RecordStatus, string> = {
  pending_review: 'bg-orange-500',
  under_review: 'bg-yellow-500',
  pending_inspection: 'bg-red-500',
  corrected: 'bg-purple-500',
  confirmed: 'bg-green-500',
}

interface StatusBadgeProps {
  status: RecordStatus
  className?: string
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
        statusColors[status],
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full', statusDotColors[status])} />
      {STATUS_LABELS[status]}
    </span>
  )
}
