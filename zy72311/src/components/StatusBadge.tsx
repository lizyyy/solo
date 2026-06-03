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

export default function StatusBadge({ status }: { status: RecordStatus }) {
  const config = statusConfig[status] || statusConfig.pending
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${config.className}`}
    >
      {config.label}
    </span>
  )
}
