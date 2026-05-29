import { useState } from 'react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ open, title, message, confirmLabel = '确认', cancelLabel = '取消', onConfirm, onCancel }: ConfirmDialogProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-serif text-lg font-semibold text-slate2-700 mb-2">{title}</h3>
        <p className="text-sm text-slate2-500 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button className="btn-secondary btn-sm" onClick={onCancel}>{cancelLabel}</button>
          <button className="btn-danger btn-sm" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  wide?: boolean
}

export function Modal({ open, onClose, title, children, wide }: ModalProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className={`bg-white rounded-xl shadow-xl max-h-[85vh] overflow-y-auto ${wide ? 'max-w-2xl' : 'max-w-md'} w-full mx-4`}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-clay-100">
          <h3 className="font-serif text-lg font-semibold text-slate2-700">{title}</h3>
          <button className="text-slate2-400 hover:text-slate2-600 transition-colors" onClick={onClose}>✕</button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  )
}

interface ToastProps {
  message: string
  type?: 'success' | 'error' | 'warning'
  onClose: () => void
}

export function Toast({ message, type = 'success', onClose }: ToastProps) {
  const bgMap = { success: 'bg-green-600', error: 'bg-red-600', warning: 'bg-kiln-400' }
  return (
    <div className={`fixed top-4 right-4 z-[60] ${bgMap[type]} text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2`}>
      <span>{message}</span>
      <button onClick={onClose} className="ml-1 opacity-70 hover:opacity-100">✕</button>
    </div>
  )
}

export function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null)
  const show = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }
  const element = toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null
  return { show, element }
}
