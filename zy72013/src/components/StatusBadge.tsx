import { STATUS_LABELS } from '../../shared/types'
import type { RecordStatus } from '../../shared/types'

const STATUS_STYLES: Record<RecordStatus, string> = {
  pending: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
  confirmed: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  returned: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
  suspended: 'bg-red-500/15 text-red-400 border border-red-500/30',
}

interface StatusBadgeProps {
  status: RecordStatus
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
