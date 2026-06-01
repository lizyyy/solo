import { useState } from 'react'
import { ChevronDown, ChevronUp, Info, AlertTriangle, XCircle } from 'lucide-react'
import type { Warning, WarningSeverity } from '@/utils/types'

const SEVERITY_CONFIG: Record<WarningSeverity, {
  icon: typeof Info
  bg: string
  border: string
  iconColor: string
  textColor: string
}> = {
  info: {
    icon: Info,
    bg: 'bg-info-bg',
    border: 'border-info',
    iconColor: 'text-info',
    textColor: 'text-info',
  },
  warn: {
    icon: AlertTriangle,
    bg: 'bg-warning-bg',
    border: 'border-warning',
    iconColor: 'text-warning',
    textColor: 'text-warning',
  },
  error: {
    icon: XCircle,
    bg: 'bg-danger-bg',
    border: 'border-danger',
    iconColor: 'text-danger',
    textColor: 'text-danger',
  },
}

interface WarningBannerProps {
  warning: Warning
}

export default function WarningBanner({ warning }: WarningBannerProps) {
  const [detailOpen, setDetailOpen] = useState(false)
  const config = SEVERITY_CONFIG[warning.severity]
  const Icon = config.icon

  return (
    <div
      className={`${config.bg} border-l-4 ${config.border} rounded-r-lg px-4 py-3 animate-slide-in`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${config.iconColor} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${config.textColor}`}>
            {warning.message}
          </p>
          {warning.detail && (
            <>
              <button
                type="button"
                onClick={() => setDetailOpen(v => !v)}
                className="flex items-center gap-1 mt-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                {detailOpen ? (
                  <>
                    收起详情
                    <ChevronUp className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    查看详情
                    <ChevronDown className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
              {detailOpen && (
                <p className="text-xs text-text-secondary mt-1.5 leading-relaxed animate-fade-in">
                  {warning.detail}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
