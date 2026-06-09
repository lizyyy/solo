import { cn } from '@/lib/utils'
import type { RecordStatus, Conclusion } from '@shared/types'

interface StatusBadgeProps {
  status?: RecordStatus
  conclusion?: Conclusion
  showText?: boolean
}

const STATUS_CONFIG: Record<RecordStatus, { cls: string; text: string }> = {
  pending: { cls: 'bg-amber-50 text-amber-700 border-amber-200', text: '待复核' },
  confirmed: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: '已复核' },
  exception: { cls: 'bg-rose-50 text-rose-700 border-rose-200', text: '异常' },
}

const CONCLUSION_CONFIG: Record<Conclusion, { cls: string; text: string }> = {
  normal: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', text: '正常' },
  observe: { cls: 'bg-amber-50 text-amber-700 border-amber-200', text: '需观察' },
  abnormal: { cls: 'bg-rose-50 text-rose-700 border-rose-200', text: '异常' },
}

export default function StatusBadge({ status, conclusion, showText = true }: StatusBadgeProps) {
  const config = status
    ? STATUS_CONFIG[status]
    : conclusion
      ? CONCLUSION_CONFIG[conclusion]
      : null
  if (!config) return null

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        config.cls,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {showText && config.text}
    </span>
  )
}
