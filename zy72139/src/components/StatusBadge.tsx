const STATUS_CONFIG: Record<string, { label: string; bg: string; dot: string; border: string }> = {
  pending: { label: '待排程', bg: 'bg-slate-100', dot: 'bg-slate-400', border: 'border-l-slate-400' },
  scheduled: { label: '已排程', bg: 'bg-emerald-50', dot: 'bg-emerald-500', border: 'border-l-emerald-500' },
  missing_auth: { label: '缺授权', bg: 'bg-orange-50', dot: 'bg-orange-500', border: 'border-l-orange-500' },
  version_conflict: { label: '版本冲突', bg: 'bg-pink-50', dot: 'bg-pink-500', border: 'border-l-pink-500' },
  duplicate: { label: '重复项', bg: 'bg-amber-50', dot: 'bg-amber-500', border: 'border-l-amber-500' },
}

export default function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} border border-transparent`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}

export { STATUS_CONFIG }
