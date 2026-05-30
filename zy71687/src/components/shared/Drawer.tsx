import { X } from 'lucide-react'

interface DrawerProps {
  open: boolean
  title: string
  onClose: () => void
  children: React.ReactNode
  width?: string
}

export default function Drawer({ open, title, onClose, children, width = 'w-[560px]' }: DrawerProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className={`relative ${width} max-w-[90vw] h-full bg-[#1a1f2e] border-l border-[#2a3040] flex flex-col overflow-hidden`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a3040]">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
