import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react"
import useAppStore from "@/store/useAppStore"
import type { ToastType } from "@/types"

const iconMap: Record<ToastType, typeof CheckCircle> = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
}

const styleMap: Record<ToastType, string> = {
  success: "bg-[#0a2a1a] border-[#0ff0b3] text-[#0ff0b3]",
  error: "bg-[#2a0a0a] border-[#ff4444] text-[#ff4444]",
  info: "bg-[#0a1a2a] border-[#4488ff] text-[#4488ff]",
  warning: "bg-[#2a1a0a] border-[#ff9f1c] text-[#ff9f1c]",
}

export default function Toast() {
  const toasts = useAppStore((s) => s.toasts)
  const removeToast = useAppStore((s) => s.removeToast)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((toast) => {
        const Icon = iconMap[toast.type]
        return (
          <div
            key={toast.id}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg animate-[slideIn_0.3s_ease-out] ${styleMap[toast.type]}`}
          >
            <Icon size={16} />
            <span className="flex-1">{toast.message}</span>
            <button onClick={() => removeToast(toast.id)} className="opacity-60 hover:opacity-100">
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
