import { cn } from '@/lib/utils'
import type { RecordType, RecordStatus } from '@/types'

const TYPE_CONFIG: Record<RecordType, { label: string; className: string }> = {
  smooth: { label: '顺利', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  mixed: { label: '待复核', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  supplement: { label: '补录', className: 'bg-sky-50 text-sky-700 ring-sky-200' },
}

const STATUS_CONFIG: Record<RecordStatus, { label: string; className: string }> = {
  pass: { label: '通过', className: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  pending_review: { label: '待复核', className: 'bg-amber-50 text-amber-700 ring-amber-200' },
  corrected: { label: '已修正', className: 'bg-purple-50 text-purple-700 ring-purple-200' },
}

interface StatusBadgeProps {
  type: 'recordType' | 'status'
  value: RecordType | RecordStatus
  className?: string
}

export default function StatusBadge({ type, value, className }: StatusBadgeProps) {
  const config = type === 'recordType' ? TYPE_CONFIG[value as RecordType] : STATUS_CONFIG[value as RecordStatus]
  if (!config) return null

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
