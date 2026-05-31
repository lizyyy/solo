import { useEffect, useCallback, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ActionModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

export default function ActionModal({ open, onClose, title, children, footer }: ActionModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose],
  )

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [open, handleEscape])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative bg-[#1e1e3a] border border-[#2a2a4a] rounded-lg w-full max-w-md mx-4 animate-modal-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a2a4a]">
          <h3 className="text-lg font-medium text-gray-100">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-4">{children}</div>
        {footer && (
          <div className="px-6 py-4 border-t border-[#2a2a4a] flex justify-end gap-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
