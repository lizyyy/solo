import { useEffect } from 'react'
import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react'
import type { ActionToast } from '@/types'
import { useGameStore } from '@/stores/gameStore'

const TOAST_STYLES: Record<ActionToast['type'], { border: string; icon: typeof CheckCircle; color: string }> = {
  success: { border: 'border-safe-green', icon: CheckCircle, color: 'text-safe-green' },
  warning: { border: 'border-risk-yellow', icon: AlertTriangle, color: 'text-risk-yellow' },
  error: { border: 'border-risk-red', icon: XCircle, color: 'text-risk-red' },
  info: { border: 'border-data-blue', icon: Info, color: 'text-data-blue' },
}

interface ActionToastProps {
  toast: ActionToast
}

export default function ActionToast({ toast }: ActionToastProps) {
  const dismissToast = useGameStore(s => s.dismissToast)
  const style = TOAST_STYLES[toast.type]
  const Icon = style.icon

  useEffect(() => {
    const timer = setTimeout(() => {
      dismissToast(toast.id)
    }, 4000)
    return () => clearTimeout(timer)
  }, [toast.id, dismissToast])

  return (
    <div
      className={`card-cafe border-l-4 ${style.border} max-w-sm animate-slide-in-right`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${style.color}`} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-cafe-brown">{toast.message}</p>
          <p className="text-xs text-cafe-brown/60 mt-0.5">{toast.detail}</p>
        </div>
        <button
          className="shrink-0 text-cafe-brown/40 hover:text-cafe-brown transition-colors"
          onClick={() => dismissToast(toast.id)}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
