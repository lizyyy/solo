import type { RiskSeverity } from '@/types'

interface SeverityBadgeProps {
  severity: RiskSeverity
  children?: React.ReactNode
}

const severityConfig = {
  high: { className: 'bg-danger-glow text-danger', label: '高危' },
  medium: { className: 'bg-warn-glow text-warn', label: '中危' },
  low: { className: 'bg-safe-glow text-safe', label: '低危' },
}

export default function SeverityBadge({ severity, children }: SeverityBadgeProps) {
  const config = severityConfig[severity]
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${config.className}`}>
      {children || config.label}
    </span>
  )
}
