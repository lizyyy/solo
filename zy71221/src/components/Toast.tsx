import { useEffect, useState } from 'react'
import { useStore } from '@/store/useStore'
import { CheckCircle, XCircle, X } from 'lucide-react'

export default function Toast() {
  const toast = useStore((s) => s.toast)
  const clearToast = useStore((s) => s.clearToast)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (!toast) {
      setExiting(false)
      return
    }
    const timer = setTimeout(() => {
      setExiting(true)
      setTimeout(() => {
        clearToast()
        setExiting(false)
      }, 300)
    }, 3000)
    return () => clearTimeout(timer)
  }, [toast, clearToast])

  if (!toast) return null

  return (
    <div className="fixed top-4 right-4 z-[100]">
      <div
        className={`flex items-center gap-3 px-5 py-3 rounded-lg shadow-2xl border ${
          toast.type === 'success'
            ? 'bg-emerald-900/90 border-emerald-700 text-emerald-100'
            : 'bg-red-900/90 border-red-700 text-red-100'
        } ${exiting ? 'toast-exit' : 'toast-enter'}`}
      >
        {toast.type === 'success' ? (
          <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 text-red-400 shrink-0" />
        )}
        <span className="text-sm font-medium">{toast.message}</span>
        <button onClick={() => { setExiting(true); setTimeout(clearToast, 300) }} className="ml-2 opacity-60 hover:opacity-100">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
