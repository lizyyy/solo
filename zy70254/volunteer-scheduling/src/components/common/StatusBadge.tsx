
import type { ScheduleStatus } from '../../types'

interface StatusBadgeProps {
  status: ScheduleStatus | 'active' | 'inactive'
}

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  待确认: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '待确认' },
  已确认: { bg: 'bg-blue-100', text: 'text-blue-800', label: '已确认' },
  进行中: { bg: 'bg-green-100', text: 'text-green-800', label: '进行中' },
  已完成: { bg: 'bg-gray-100', text: 'text-gray-800', label: '已完成' },
  已取消: { bg: 'bg-red-100', text: 'text-red-800', label: '已取消' },
  需改派: { bg: 'bg-orange-100', text: 'text-orange-800', label: '需改派' },
  active: { bg: 'bg-green-100', text: 'text-green-800', label: '活跃' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-500', label: '停用' },
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status }
  return (
    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  )
}
