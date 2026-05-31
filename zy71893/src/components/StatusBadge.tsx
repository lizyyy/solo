import { RECORD_STATUS_LABELS } from '@/types'
import type { RecordStatus } from '@/types'

interface StatusBadgeProps {
  status: RecordStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={`status-pill status-${status} ${className ?? ''}`}>
      {RECORD_STATUS_LABELS[status]}
    </span>
  )
}
