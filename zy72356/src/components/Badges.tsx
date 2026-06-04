import { cn } from '@/lib/utils'
import type { RecordDetail } from '@/store'

export function StatusBadge({ status }: { status: RecordDetail['status'] }) {
  const configs: Record<RecordDetail['status'], { label: string; className: string }> = {
    normal: { label: '正常', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    mixed_unit: { label: '混用待复核', className: 'bg-amber-100 text-amber-700 border-amber-200' },
    anomaly: { label: '异常', className: 'bg-red-100 text-red-700 border-red-200' },
    confirmed: { label: '已确认', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    rolled_back: { label: '已回滚', className: 'bg-slate-200 text-slate-700 border-slate-300' },
  }
  const { label, className } = configs[status]
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border', className)}>
      {label}
    </span>
  )
}

export function CredibilityBadge({ credibility }: { credibility: RecordDetail['credibility'] }) {
  if (!credibility) return null
  const configs: Record<NonNullable<RecordDetail['credibility']>, { label: string; className: string }> = {
    sensor_trusted: { label: '传感器可信', className: 'bg-blue-100 text-blue-700 border-blue-200' },
    photo_trusted: { label: '照片可信', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    pending_confirmation: { label: '待确认', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  }
  const { label, className } = configs[credibility]
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border', className)}>
      {label}
    </span>
  )
}

export function SourceBadge({ source }: { source: RecordDetail['source'] }) {
  const configs: Record<RecordDetail['source'], { label: string; className: string }> = {
    sensor_original: { label: '传感器原始', className: 'bg-slate-100 text-slate-700 border-slate-200' },
    photo_corrected: { label: '照片修正', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
    coach_confirmed: { label: '教练确认', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    rolled_back: { label: '已回滚', className: 'bg-slate-200 text-slate-600 border-slate-300' },
  }
  const { label, className } = configs[source]
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border', className)}>
      {label}
    </span>
  )
}

export function UnitBadge({ unit }: { unit: 'C' | 'K' }) {
  const label = unit === 'C' ? '°C' : 'K'
  const className = unit === 'C'
    ? 'bg-rose-100 text-rose-700 border-rose-200'
    : 'bg-sky-100 text-sky-700 border-sky-200'
  return (
    <span className={cn('inline-flex items-center px-1.5 py-0.5 text-xs font-mono font-bold rounded border', className)}>
      {label}
    </span>
  )
}
