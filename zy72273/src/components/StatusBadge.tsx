import { cn } from '@/lib/utils'

const statusConfig: Record<string, { label: string; className: string }> = {
  calibrated: {
    label: '已校准',
    className: 'bg-status-green/15 text-status-green border-status-green/30',
  },
  pending_review: {
    label: '待复核',
    className: 'bg-status-red/15 text-status-red border-status-red/30',
  },
  pending_photo: {
    label: '待补录',
    className: 'bg-status-blue/15 text-status-blue border-status-blue/30',
  },
  anomaly: {
    label: '有异常',
    className: 'bg-accent/15 text-accent border-accent/30',
  },
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    className: 'bg-text-secondary/15 text-text-secondary border-text-secondary/30',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium border',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  )
}
