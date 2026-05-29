import { useStore } from '@/store'
import { X, AlertTriangle, Info, AlertCircle, CheckCircle } from 'lucide-react'

const iconMap = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const colorMap = {
  success: 'border-[#00D9A6] bg-[#00D9A6]/10 text-[#00D9A6]',
  error: 'border-[#E74C3C] bg-[#E74C3C]/10 text-[#E74C3C]',
  warning: 'border-[#F5A623] bg-[#F5A623]/10 text-[#F5A623]',
  info: 'border-[#4A9EFF] bg-[#4A9EFF]/10 text-[#4A9EFF]',
}

export default function ToastContainer() {
  const toasts = useStore((s) => s.toasts)
  const removeToast = useStore((s) => s.removeToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-2 max-w-sm">
      {toasts.map((t) => {
        const Icon = iconMap[t.type]
        return (
          <div
            key={t.id}
            className={`flex items-start gap-2.5 px-4 py-3 rounded border-l-4 ${colorMap[t.type]} animate-slide-in`}
          >
            <Icon className="w-4 h-4 mt-0.5 shrink-0" />
            <span className="text-xs leading-relaxed flex-1">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
