import { Link } from 'react-router-dom'
import { Calendar, Clock, Eye, History as HistoryIcon } from 'lucide-react'
import type { TempRecord, RecordStatus, Conclusion } from '@shared/types'
import StatusBadge from './StatusBadge'
import { cn } from '@/lib/utils'

const STATUS_BAR: Record<RecordStatus, string> = {
  pending: 'bg-amber-400',
  confirmed: 'bg-emerald-500',
  exception: 'bg-rose-500',
}

const CONCLUSION_BAR: Record<Conclusion, string> = {
  normal: 'bg-emerald-500',
  observe: 'bg-amber-400',
  abnormal: 'bg-rose-500',
}

const CONCLUSION_TEXT: Record<Conclusion, string> = {
  normal: '结论正常',
  observe: '需持续观察',
  abnormal: '检测异常',
}

export default function RecordCard({ record }: { record: TempRecord }) {
  const barColor = STATUS_BAR[record.status] ?? CONCLUSION_BAR[record.conclusion]

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all hover:shadow-md">
      <span className={cn('absolute inset-y-0 left-0 w-1', barColor)} />

      <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-2 pl-6">
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-xl font-semibold leading-tight text-slate-900">
            {record.petName}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{record.ownerName}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
              {record.petType}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {record.visitDate}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <code className="font-mono text-[11px] text-slate-400">{record.code}</code>
          <StatusBadge status={record.status} />
        </div>
      </div>

      <div className="flex items-center justify-between px-5 py-2 pl-6">
        <div className="flex items-center gap-2">
          <StatusBadge conclusion={record.conclusion} />
          <span className="text-sm text-slate-600">{CONCLUSION_TEXT[record.conclusion]}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 px-5 py-2 pl-6">
        {record.factors.slice(0, 2).map((f) => (
          <span
            key={f.id}
            className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600"
          >
            {f.label}
          </span>
        ))}
        {record.hasLegacyCurve && (
          <span className="inline-flex items-center rounded-md bg-slate-200 px-2 py-0.5 text-[11px] text-slate-700">
            旧版
          </span>
        )}
        {record.isBoundarySample && (
          <span className="inline-flex items-center rounded-md bg-amber-100 px-2 py-0.5 text-[11px] text-amber-700">
            边界
          </span>
        )}
      </div>

      <div className="mt-1 flex items-center justify-between border-t border-slate-100 px-5 py-3 pl-6">
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
          <Clock className="h-3 w-3" />
          更新于 {record.updatedAt}
        </span>
        <div className="flex items-center gap-1">
          <Link
            to={`/records/${record.id}`}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
          >
            <Eye className="h-3.5 w-3.5" />
            查看详情
          </Link>
          <Link
            to={`/records/${record.id}/history`}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <HistoryIcon className="h-3.5 w-3.5" />
            查看历史
          </Link>
        </div>
      </div>
    </article>
  )
}
