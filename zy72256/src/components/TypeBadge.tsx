import type { CoordinateType } from '@shared/types'
import { TYPE_LABELS } from '@shared/types'
import { cn } from '@/lib/utils'

const typeColors: Record<CoordinateType, string> = {
  longitude_latitude: 'bg-blue-100 text-blue-700 border-blue-300',
  metric: 'bg-cyan-100 text-cyan-700 border-cyan-300',
  mixed: 'bg-orange-100 text-orange-700 border-orange-300',
}

interface TypeBadgeProps {
  type: CoordinateType
  className?: string
  blink?: boolean
}

export default function TypeBadge({ type, className, blink }: TypeBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        typeColors[type],
        type === 'mixed' && blink && 'mixed-blink',
        className
      )}
    >
      {TYPE_LABELS[type]}
    </span>
  )
}
