import { AlertTriangle } from 'lucide-react'

interface ConfirmModalProps {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmModal({ title, message, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-bg-card border border-border rounded-lg w-full max-w-md p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle size={20} className="text-accent" />
          <h3 className="font-heading font-semibold text-text-primary">{title}</h3>
        </div>
        <p className="text-sm text-text-secondary mb-6 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-sm border border-border text-text-secondary hover:bg-bg-secondary transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => {
              onConfirm()
              onCancel()
            }}
            className="px-4 py-2 rounded-md text-sm bg-accent text-white hover:bg-accent/90 transition-colors"
          >
            确认
          </button>
        </div>
      </div>
    </div>
  )
}
