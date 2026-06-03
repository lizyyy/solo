import type { RecordStatus } from '@/types'

const statusConfig: Record<RecordStatus, { label: string; color: string }> = {
  smooth: { label: '顺利', color: '#00D68F' },
  pending_review: { label: '待复核', color: '#FFAA00' },
  old_caliber_supplemented: { label: '旧口径补录', color: '#FF6B6B' },
}

export default function StatusBadge({ status }: { status: RecordStatus }) {
  const { label, color } = statusConfig[status]

  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border"
      style={{
        backgroundColor: `${color}26`,
        color,
        borderColor: `${color}4D`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full mr-1.5"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  )
}
