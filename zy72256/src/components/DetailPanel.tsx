import { useEffect, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface DetailPanelProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  width?: number
}

export default function DetailPanel({ open, onClose, title, children, width = 480 }: DetailPanelProps) {
  const [visible, setVisible] = useState(false)
  const [animating, setAnimating] = useState(false)

  useEffect(() => {
    if (open) {
      setVisible(true)
      setAnimating(true)
    } else if (visible) {
      setAnimating(true)
      const timer = setTimeout(() => {
        setVisible(false)
        setAnimating(false)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [open, visible])

  if (!visible) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40 transition-opacity duration-300"
        style={{ opacity: open ? 1 : 0 }}
        onClick={onClose}
      />
      <div
        className={cn_panel(animating, open)}
        style={{ width: `${width}px` }}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white sticky top-0 z-10">
          <h3 className="text-lg font-semibold text-gray-900 truncate pr-4">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 65px)' }}>
          {children}
        </div>
      </div>
    </>
  )
}

function cn_panel(animating: boolean, open: boolean): string {
  let cls = 'fixed top-0 right-0 h-full bg-white shadow-2xl z-50 flex flex-col'
  if (animating) {
    cls += open ? ' detail-panel-enter' : ' detail-panel-exit'
  }
  return cls
}
