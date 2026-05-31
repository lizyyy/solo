import { STATUS_LABELS, STATUS_COLORS } from './StatusFilterBar'

interface StatusBadgeProps {
  status: string
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const colorClass = STATUS_COLORS[status] || 'bg-stone-100 text-stone-600'
  return (
    <span className={`inline-block px-2 py-0.5 text-xs font-medium ${colorClass}`}>
      {STATUS_LABELS[status] || status}
    </span>
  )
}
