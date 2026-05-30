import { VALIDATION_STATUS_CONFIG } from '@/types'
import type { ValidationStatus } from '@/types'

interface ValidationBadgeProps {
  status: ValidationStatus
}

export default function ValidationBadge({ status }: ValidationBadgeProps) {
  const config = VALIDATION_STATUS_CONFIG[status]

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs"
      style={{ backgroundColor: config.bg, color: config.color }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: config.color }}
      />
      {config.label}
    </span>
  )
}
