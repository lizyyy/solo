import type { Status } from '../../types'

interface StatusTagProps {
  status: Status
}

const statusConfig: Record<Status, { icon: string; label: string; className: string }> = {
  pending: {
    icon: '⏳',
    label: '待处理',
    className: 'bg-amber-100 text-amber-700',
  },
  reviewing: {
    icon: '🔍',
    label: '复核中',
    className: 'bg-rust-50 text-rust-600',
  },
  processed: {
    icon: '✅',
    label: '已处理',
    className: 'bg-clay-50 text-clay-600',
  },
  completed: {
    icon: '🎉',
    label: '已完成',
    className: 'bg-sage-50 text-sage-700',
  },
}

export default function StatusTag({ status }: StatusTagProps) {
  const config = statusConfig[status]
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${config.className}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  )
}
