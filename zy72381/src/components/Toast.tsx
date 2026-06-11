import { CheckCircle, AlertTriangle, XCircle, Info, X } from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { clsx } from 'clsx'

export function Toast() {
  const { toasts, removeToast } = useAppStore()

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-success-500" />
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning-500" />
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />
      default:
        return <Info className="w-5 h-5 text-industrial-400" />
    }
  }

  const getBgColor = (type: string) => {
    switch (type) {
      case 'success':
        return 'bg-success-500/10 border-success-500/30'
      case 'warning':
        return 'bg-warning-500/10 border-warning-500/30'
      case 'error':
        return 'bg-red-500/10 border-red-500/30'
      default:
        return 'bg-industrial-700/50 border-industrial-600'
    }
  }

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(
            'flex items-center gap-3 px-4 py-3 rounded-lg border card-shadow min-w-64',
            getBgColor(toast.type)
          )}
        >
          {getIcon(toast.type)}
          <span className="flex-1 text-industrial-200 text-sm">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="p-1 hover:bg-industrial-600 rounded transition-colors"
          >
            <X className="w-4 h-4 text-industrial-400" />
          </button>
        </div>
      ))}
    </div>
  )
}
