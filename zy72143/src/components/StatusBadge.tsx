import type { TrackStatus } from '@/types'
import { cn } from '@/lib/utils'

const statusConfig: Record<TrackStatus, { label: string; dotClass: string; bgClass: string; textClass: string }> = {
  passed: {
    label: '已通过',
    dotClass: 'bg-emerald-500',
    bgClass: 'bg-emerald-500/10',
    textClass: 'text-emerald-400',
  },
  needs_review: {
    label: '需人工确认',
    dotClass: 'bg-amber-500',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-400',
  },
  old_caliber: {
    label: '已标记旧口径',
    dotClass: 'bg-slate-400',
    bgClass: 'bg-slate-400/10',
    textClass: 'text-slate-400',
  },
  pending: {
    label: '待处理',
    dotClass: 'bg-sky-500',
    bgClass: 'bg-sky-500/10',
    textClass: 'text-sky-400',
  },
}

interface StatusBadgeProps {
  status: TrackStatus
  className?: string
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.bgClass,
        config.textClass,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', config.dotClass)} />
      {config.label}
    </span>
  )
}
