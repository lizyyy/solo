import { useMemo } from 'react'
import type { InspectionRecord } from '@/types'
import { useInspectionStore } from '@/store/inspectionStore'
import {
  ShieldCheck,
  Clock,
  AlertTriangle,
  FileText,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const supplementReasonLabel = {
  config_early: '配置文件早到',
  log_late: '失败日志晚补',
} as const

function LedgerCard({ record, onConfirm }: { record: InspectionRecord; onConfirm: (id: string) => void }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{record.linkName}</p>
          <p className="text-xs text-slate-500 font-mono mt-0.5 truncate">{record.linkUrl}</p>
        </div>
        {record.status !== 'confirmed' && (
          <button
            onClick={() => onConfirm(record.id)}
            className="shrink-0 flex items-center gap-1 px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium transition-colors"
          >
            <CheckCircle2 size={12} />
            确认
          </button>
        )}
      </div>

      <p className="text-xs text-slate-600 mt-2 leading-relaxed">{record.judgmentReason}</p>

      <div className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
        <ArrowRight size={12} className="mt-0.5 shrink-0 text-amber-500" />
        <span>{record.nextStep}</span>
      </div>

      <div className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
        <FileText size={12} className="mt-0.5 shrink-0 text-indigo-500" />
        <span className="font-medium">{record.processingStandard}</span>
      </div>

      {record.supplementDetail && (
        <div className="mt-2 text-xs bg-amber-50 border border-amber-200 rounded px-3 py-1.5 text-amber-800">
          {record.supplementReason && (
            <span className="font-semibold">{supplementReasonLabel[record.supplementReason]}：</span>
          )}
          {record.supplementDetail}
        </div>
      )}

      {record.beforeChange && record.afterChange && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div className="bg-rose-50 border border-rose-200 rounded px-2 py-1.5">
            <span className="text-rose-500 font-semibold">前：</span>
            <span className="text-slate-700">{record.beforeChange}</span>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded px-2 py-1.5">
            <span className="text-emerald-600 font-semibold">后：</span>
            <span className="text-slate-700">{record.afterChange}</span>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-400 mt-2">{record.inspectedAt}</p>
    </div>
  )
}

function LedgerColumn({
  title,
  icon: Icon,
  color,
  status,
  emptyText,
}: {
  title: string
  icon: React.ElementType
  color: string
  status: InspectionRecord['status']
  emptyText: string
}) {
  const allRecords = useInspectionStore((s) => s.records)
  const confirmRecord = useInspectionStore((s) => s.confirmRecord)

  const records = useMemo(
    () => allRecords.filter((r) => r.status === status),
    [allRecords, status]
  )

  return (
    <div className="flex-1 min-w-0">
      <div className={cn('flex items-center gap-2 px-4 py-2.5 rounded-t-lg', color)}>
        <Icon size={16} className="text-white" />
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <span className="ml-auto bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-semibold">
          {records.length}
        </span>
      </div>
      <div className="bg-slate-50 border border-t-0 border-slate-200 rounded-b-lg p-3 space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto">
        {records.length === 0 && (
          <p className="text-xs text-slate-400 text-center py-8">{emptyText}</p>
        )}
        {records.map((r) => (
          <LedgerCard key={r.id} record={r} onConfirm={confirmRecord} />
        ))}
      </div>
    </div>
  )
}

export default LedgerColumn
