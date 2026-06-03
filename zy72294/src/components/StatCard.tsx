import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

type StatStatus = 'warning' | 'success' | 'info'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  status: StatStatus
  action?: {
    label: string
    onClick: () => void
  }
}

const statusConfig: Record<StatStatus, { bg: string; icon: string; border: string }> = {
  warning: {
    bg: 'bg-warning-50',
    icon: 'bg-warning-500 text-white',
    border: 'border-warning-200',
  },
  success: {
    bg: 'bg-success-50',
    icon: 'bg-success-500 text-white',
    border: 'border-success-200',
  },
  info: {
    bg: 'bg-industrial-50',
    icon: 'bg-industrial-500 text-white',
    border: 'border-industrial-200',
  },
}

export default function StatCard({ title, value, icon: Icon, status, action }: StatCardProps) {
  const config = statusConfig[status]
  return (
    <div
      className={cn(
        'rounded-lg border bg-white p-4 shadow-card',
        config.border
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex items-center justify-center w-12 h-12 rounded shrink-0',
            config.icon
          )}
        >
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-500 truncate">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
      {action && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={action.onClick}
            className="text-sm font-medium text-industrial-600 hover:text-industrial-700 transition-colors"
          >
            {action.label} →
          </button>
        </div>
      )}
    </div>
  )
}
