import { useMemo } from 'react'
import type { InspectionRecord } from '@/types'
import { useInspectionStore } from '@/store/inspectionStore'
import {
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Clock,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const statusConfig = {
  confirmed: {
    label: '已确认',
    border: 'border-l-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700',
    icon: ShieldCheck,
  },
  pending_supplement: {
    label: '待补',
    border: 'border-l-amber-500',
    badge: 'bg-amber-50 text-amber-700',
    icon: Clock,
  },
  manually_modified: {
    label: '人工改过',
    border: 'border-l-rose-500',
    badge: 'bg-rose-50 text-rose-700',
    icon: AlertTriangle,
  },
} as const

const categoryLabel = {
  supplement: '补材料',
  conclusion_changed: '改结论',
  confirmed: '已确认',
} as const

const supplementReasonLabel = {
  config_early: '配置文件早到',
  log_late: '失败日志晚补',
} as const

function RecordCard({ record }: { record: InspectionRecord }) {
  const expandedId = useInspectionStore((s) => s.expandedId)
  const toggleExpand = useInspectionStore((s) => s.toggleExpand)
  const confirmRecord = useInspectionStore((s) => s.confirmRecord)

  const isExpanded = expandedId === record.id
  const config = statusConfig[record.status]
  const StatusIcon = config.icon

  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-slate-200 border-l-4 shadow-sm transition-shadow hover:shadow-md',
        config.border
      )}
    >
      <button
        onClick={() => toggleExpand(record.id)}
        className="w-full px-5 py-4 flex items-start gap-4 text-left"
      >
        <StatusIcon size={20} className="mt-0.5 shrink-0 text-slate-400" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-slate-800">{record.linkName}</span>
            <span className={cn('px-2 py-0.5 rounded text-xs font-medium', config.badge)}>
              {config.label}
            </span>
            <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-500">
              {categoryLabel[record.category]}
            </span>
            {record.supplementReason && (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-600">
                {supplementReasonLabel[record.supplementReason]}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1 font-mono truncate">{record.linkUrl}</p>
          <p className="text-xs text-slate-600 mt-1 line-clamp-1">{record.judgmentReason}</p>
        </div>
        <div className="shrink-0 mt-1">
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {isExpanded && (
        <div className="px-5 pb-4 border-t border-slate-100 pt-4 ml-9 space-y-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">判断理由</p>
            <p className="text-sm text-slate-700 bg-slate-50 rounded-lg px-4 py-3 leading-relaxed">
              {record.judgmentReason}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">下一步操作</p>
            <div className="flex items-start gap-2 text-sm text-slate-700">
              <ArrowRight size={16} className="mt-0.5 shrink-0 text-amber-500" />
              <span>{record.nextStep}</span>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">处理口径</p>
            <div className="flex items-start gap-2 text-sm text-slate-700">
              <FileText size={16} className="mt-0.5 shrink-0 text-indigo-500" />
              <span>{record.processingStandard}</span>
            </div>
          </div>

          {record.supplementDetail && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">缺失材料详情</p>
              <p className="text-sm text-slate-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                {record.supplementDetail}
              </p>
            </div>
          )}

          {record.beforeChange && record.afterChange && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">变更对比</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
                  <p className="text-xs text-rose-500 font-semibold mb-1">改动前</p>
                  <p className="text-sm text-slate-700">{record.beforeChange}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                  <p className="text-xs text-emerald-600 font-semibold mb-1">改动后</p>
                  <p className="text-sm text-slate-700">{record.afterChange}</p>
                </div>
              </div>
              {record.changeNote && (
                <p className="text-xs text-slate-500 mt-2 italic">备注：{record.changeNote}</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">巡检时间：{record.inspectedAt}</span>
            {record.status !== 'confirmed' && (
              <button
                onClick={() => confirmRecord(record.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <CheckCircle2 size={14} />
                确认
              </button>
            )}
            {record.confirmedAt && (
              <span className="text-xs text-emerald-600">确认于 {record.confirmedAt}</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function RecordList() {
  const records = useInspectionStore((s) => s.records)
  const filter = useInspectionStore((s) => s.filter)

  const filtered = useMemo(() => {
    if (filter === 'all') return records
    return records.filter((r) => r.category === filter)
  }, [records, filter])

  return (
    <div className="space-y-3">
      {filtered.map((record) => (
        <RecordCard key={record.id} record={record} />
      ))}
      {filtered.length === 0 && (
        <div className="text-center py-12 text-slate-400 text-sm">无匹配记录</div>
      )}
    </div>
  )
}
