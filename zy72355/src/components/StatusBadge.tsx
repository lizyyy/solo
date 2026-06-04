const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  '待补看': { label: '待补看', color: 'text-zinc-600', bg: 'bg-zinc-100' },
  '已补看': { label: '已补看', color: 'text-blue-700', bg: 'bg-blue-50' },
  '待实验老师复核': { label: '待复核', color: 'text-amber-700', bg: 'bg-amber-50' },
  '已确认异常': { label: '已确认异常', color: 'text-red-700', bg: 'bg-red-50' },
  '归正常': { label: '归正常', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  '退回': { label: '退回', color: 'text-purple-700', bg: 'bg-purple-50' },
}

interface StatusBadgeProps {
  status: string
  boundaryFlag?: number
}

export default function StatusBadge({ status, boundaryFlag }: StatusBadgeProps) {
  const config = statusConfig[status] || { label: status, color: 'text-zinc-600', bg: 'bg-zinc-100' }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.color} ${config.bg}`}>
      {boundaryFlag ? '⚠ ' : ''}
      {config.label}
    </span>
  )
}
