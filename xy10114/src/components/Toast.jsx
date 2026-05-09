import { useEffect } from 'react'
import { CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react'
import './Toast.css'

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertCircle,
  info: Info
}

const colors = {
  success: { bg: '#ecfdf5', border: '#34d399', text: '#065f46', icon: '#10b981' },
  error: { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b', icon: '#ef4444' },
  warning: { bg: '#fffbeb', border: '#fcd34d', text: '#92400e', icon: '#f59e0b' },
  info: { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af', icon: '#3b82f6' }
}

export default function Toast({ message, type = 'info', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [onClose])

  const Icon = icons[type]
  const color = colors[type]

  return (
    <div 
      className="toast"
      style={{ 
        backgroundColor: color.bg,
        borderColor: color.border,
        color: color.text
      }}
    >
      <Icon size={20} style={{ color: color.icon, flexShrink: 0 }} />
      <span className="toast-message">{message}</span>
      <button className="toast-close" onClick={onClose}>
        <XCircle size={16} />
      </button>
    </div>
  )
}
