import type { AnomalyType } from '@/types'
import { cn } from '@/lib/utils'

const anomalyConfig: Record<string, { label: string; bgClass: string; textClass: string }> = {
  old_master: {
    label: '旧版母带',
    bgClass: 'bg-orange-500/10',
    textClass: 'text-orange-400',
  },
  duplicate: {
    label: '重复曲目',
    bgClass: 'bg-purple-500/10',
    textClass: 'text-purple-400',
  },
  missing_auth: {
    label: '缺授权',
    bgClass: 'bg-red-500/10',
    textClass: 'text-red-400',
  },
  manual_rename: {
    label: '人工改名',
    bgClass: 'bg-cyan-500/10',
    textClass: 'text-cyan-400',
  },
}

interface AnomalyBadgeProps {
  type: AnomalyType
  className?: string
}

export default function AnomalyBadge({ type, className }: AnomalyBadgeProps) {
  if (!type || type === 'none') return null

  const config = anomalyConfig[type]
  if (!config) return null

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        config.bgClass,
        config.textClass,
        className,
      )}
    >
      {config.label}
    </span>
  )
}
