import type { RecordStatus } from '@/store/useStore'

const statusConfig: Record<RecordStatus, { label: string; className: string }> = {
  normal: { label: '正常', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  zero_denominator_empty: { label: '分母为0', className: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  supplemented: { label: '补录', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  pending: { label: '待处理', className: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
  review: { label: '待复核', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  confirmed: { label: '已确认', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  rejected: { label: '已驳回', className: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
}

const sourceConfig: Record<string, { label: string; className: string }> = {
  questionnaire: { label: '问卷导入', className: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  boundary_note: { label: '边界值说明', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  manual: { label: '手动', className: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
}

interface StatusBadgeProps {
  status?: RecordStatus
  type?: 'status' | 'source'
  source?: string
}

export default function StatusBadge({ status, type = 'status', source }: StatusBadgeProps) {
  if (type === 'source' && source) {
    const config = sourceConfig[source] || { label: source, className: 'bg-slate-500/15 text-slate-400 border-slate-500/30' }
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config.className}`}
      >
        {config.label}
      </span>
    )
  }

  const config = status ? (statusConfig[status] || statusConfig.pending) : statusConfig.pending
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config.className}`}
    >
      {config.label}
    </span>
  )
}
