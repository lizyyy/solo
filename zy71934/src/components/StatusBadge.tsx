import { type RecordStatus, STATUS_LABELS, STATUS_COLORS } from '@/types'

const STATUS_BG: Record<RecordStatus, string> = {
  confirmed: 'rgba(123, 163, 126, 0.12)',
  pending: 'rgba(212, 168, 67, 0.12)',
  manual_corrected: 'rgba(199, 92, 92, 0.12)',
}

export default function StatusBadge({ status }: { status: RecordStatus }) {
  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{
        color: STATUS_COLORS[status],
        backgroundColor: STATUS_BG[status],
      }}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
