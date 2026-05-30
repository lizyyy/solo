import type { BusinessError } from '@/lib/api'
import { AlertTriangle, AlertCircle, Skull } from 'lucide-react'

const SEVERITY_CONFIG = {
  warning: { icon: AlertTriangle, color: 'text-warning border-warning/30 bg-warning/10', label: '警告' },
  error: { icon: AlertCircle, color: 'text-margin-call border-margin-call/30 bg-margin-call/10', label: '错误' },
  fatal: { icon: Skull, color: 'text-force-liq border-force-liq/30 bg-force-liq/10', label: '致命' },
}

interface ErrorAlertProps {
  error: BusinessError
  onClose?: () => void
}

export default function ErrorAlert({ error, onClose }: ErrorAlertProps) {
  const config = SEVERITY_CONFIG[error.severity]
  const Icon = config.icon

  return (
    <div className={`rounded-lg border p-4 ${config.color}`}>
      <div className="flex items-start gap-3">
        <Icon size={18} className="mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium uppercase">{config.label}</span>
            <span className="text-xs opacity-70">
              {error.sourceFile}{error.sourceLine ? `:${error.sourceLine}` : ''}
            </span>
          </div>
          <p className="text-sm">{error.message}</p>
          {error.objectKey && (
            <p className="text-xs mt-1 opacity-60">对象: {error.objectKey}</p>
          )}
        </div>
        {onClose && (
          <button onClick={onClose} className="text-current opacity-50 hover:opacity-100 shrink-0">
            ×
          </button>
        )}
      </div>
    </div>
  )
}
