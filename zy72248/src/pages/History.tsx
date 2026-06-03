import { useState, useMemo } from 'react'
import {
  ArrowDownCircle,
  ShieldCheck,
  ShieldAlert,
  PenLine,
  Shield,
  Download,
  FileCheck,
  Search,
  ChevronDown,
  ChevronUp,
  Calendar,
  Filter,
  FileText,
  Clock,
} from 'lucide-react'
import { useBillStore } from '@/store/billStore'
import type { HistoryAction, HistoryRecord } from '@/types'
import { cn } from '@/lib/utils'

const ACTION_CONFIG: Record<
  HistoryAction,
  { label: string; icon: typeof ArrowDownCircle; colorClass: string; bgClass: string; ringClass: string; nodeColor: string }
> = {
  import: {
    label: '导入',
    icon: ArrowDownCircle,
    colorClass: 'text-blue-600',
    bgClass: 'bg-blue-50',
    ringClass: 'ring-blue-200',
    nodeColor: 'bg-blue-500',
  },
  self_check: {
    label: '自检',
    icon: ShieldCheck,
    colorClass: 'text-emerald-600',
    bgClass: 'bg-emerald-50',
    ringClass: 'ring-emerald-200',
    nodeColor: 'bg-emerald-500',
  },
  conflict_resolve: {
    label: '冲突裁决',
    icon: ShieldAlert,
    colorClass: 'text-crimson-500',
    bgClass: 'bg-crimson-50',
    ringClass: 'ring-crimson-100',
    nodeColor: 'bg-crimson-500',
  },
  supplement_step: {
    label: '补录步骤',
    icon: PenLine,
    colorClass: 'text-amber-500',
    bgClass: 'bg-amber-50',
    ringClass: 'ring-amber-100',
    nodeColor: 'bg-amber-500',
  },
  risk_review: {
    label: '风控复核',
    icon: Shield,
    colorClass: 'text-crimson-500',
    bgClass: 'bg-crimson-50',
    ringClass: 'ring-crimson-100',
    nodeColor: 'bg-crimson-500',
  },
  export: {
    label: '导出',
    icon: Download,
    colorClass: 'text-blue-600',
    bgClass: 'bg-blue-50',
    ringClass: 'ring-blue-200',
    nodeColor: 'bg-blue-500',
  },
  summary_update: {
    label: '摘要更新',
    icon: FileCheck,
    colorClass: 'text-emerald-600',
    bgClass: 'bg-emerald-50',
    ringClass: 'ring-emerald-200',
    nodeColor: 'bg-emerald-500',
  },
}

function getNodeColorByOutcome(record: HistoryRecord): string {
  const after = safeParse(record.afterSnapshot)
  if (record.action === 'risk_review') {
    return after?.riskReviewStatus === 'approved' ? 'bg-emerald-500' : 'bg-crimson-500'
  }
  if (record.action === 'conflict_resolve') {
    return after?.resolution === 'rejected' ? 'bg-crimson-500' : 'bg-emerald-500'
  }
  if (record.action === 'self_check') {
    if (Array.isArray(after)) {
      const allPassed = (after as Record<string, unknown>[]).every((r) => r.passed)
      return allPassed ? 'bg-emerald-500' : 'bg-amber-500'
    }
    return 'bg-emerald-500'
  }
  return ACTION_CONFIG[record.action].nodeColor
}

function getNodeRingByOutcome(record: HistoryRecord): string {
  const color = getNodeColorByOutcome(record)
  if (color === 'bg-emerald-500') return 'ring-emerald-200'
  if (color === 'bg-crimson-500') return 'ring-crimson-100'
  if (color === 'bg-amber-500') return 'ring-amber-100'
  return 'ring-blue-200'
}

function safeParse(json: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(json)
    if (typeof parsed === 'object' && parsed !== null) return parsed
    return null
  } catch {
    return null
  }
}

function DiffViewer({ before, after }: { before: string; after: string }) {
  const beforeObj = safeParse(before)
  const afterObj = safeParse(after)

  if (!beforeObj && !afterObj) return null

  const allKeys = Array.from(
    new Set([...Object.keys(beforeObj || {}), ...Object.keys(afterObj || {})])
  )

  if (allKeys.length === 0) return null

  const FIELD_LABELS: Record<string, string> = {
    status: '状态',
    amount: '金额',
    supplementStep: '补录步骤',
    conflictResolved: '冲突已解决',
    resolution: '裁决结果',
    riskReviewStatus: '风控复核状态',
  }

  return (
    <div className="mt-3 rounded-lg border border-navy-100 overflow-hidden text-sm">
      <div className="grid grid-cols-[120px_1fr_1fr] bg-navy-50 text-navy-500 text-xs font-semibold">
        <div className="px-3 py-2 border-r border-navy-100">字段</div>
        <div className="px-3 py-2 border-r border-navy-100">变更前</div>
        <div className="px-3 py-2">变更后</div>
      </div>
      {allKeys.map((key) => {
        const beforeVal = beforeObj?.[key]
        const afterVal = afterObj?.[key]
        const changed = JSON.stringify(beforeVal) !== JSON.stringify(afterVal)
        return (
          <div
            key={key}
            className={cn(
              'grid grid-cols-[120px_1fr_1fr] border-t border-navy-100',
              changed && 'bg-amber-50'
            )}
          >
            <div className="px-3 py-2 border-r border-navy-100 text-navy-300 font-mono text-xs">
              {FIELD_LABELS[key] || key}
            </div>
            <div
              className={cn(
                'px-3 py-2 border-r border-navy-100 font-mono text-xs',
                changed ? 'text-crimson-500 line-through' : 'text-navy-200'
              )}
            >
              {beforeVal !== undefined ? String(beforeVal) : '—'}
            </div>
            <div
              className={cn(
                'px-3 py-2 font-mono text-xs',
                changed ? 'text-emerald-600 font-semibold' : 'text-navy-200'
              )}
            >
              {afterVal !== undefined ? String(afterVal) : '—'}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TimelineCard({ record, expanded, onToggle }: { record: HistoryRecord; expanded: boolean; onToggle: () => void }) {
  const items = useBillStore((s) => s.items)
  const config = ACTION_CONFIG[record.action]
  const Icon = config.icon
  const nodeColor = getNodeColorByOutcome(record)
  const nodeRing = getNodeRingByOutcome(record)
  const billItem = items.find((it) => it.id === record.billItemId)

  return (
    <div className="relative flex gap-4">
      <div className="flex flex-col items-center flex-shrink-0 w-10">
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center ring-4',
            nodeColor,
            nodeRing,
            'text-white shadow-sm'
          )}
        >
          <Icon size={18} />
        </div>
        <div className="flex-1 w-px bg-navy-100 mt-1" />
      </div>

      <div className="flex-1 pb-8 min-w-0">
        <div
          className={cn(
            'rounded-xl border transition-shadow cursor-pointer',
            'bg-white border-navy-100 hover:shadow-md',
            expanded && 'shadow-md'
          )}
          onClick={onToggle}
        >
          <div className="px-4 py-3 flex items-center gap-3">
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold',
                config.bgClass,
                config.colorClass
              )}
            >
              {config.label}
            </span>
            <span className="text-sm text-navy-500 font-medium truncate flex-1">
              {record.detail}
            </span>
            <span className="text-xs text-navy-200 font-mono flex-shrink-0">
              {record.timestamp}
            </span>
            {expanded ? (
              <ChevronUp size={16} className="text-navy-200 flex-shrink-0" />
            ) : (
              <ChevronDown size={16} className="text-navy-200 flex-shrink-0" />
            )}
          </div>

          {expanded && (
            <div className="px-4 pb-4 border-t border-navy-50">
              <div className="flex items-center gap-4 mt-3 text-xs text-navy-300">
                <span className="flex items-center gap-1">
                  <FileText size={12} />
                  操作人：<strong className="text-navy-500">{record.operator}</strong>
                </span>
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  时间：<span className="font-mono">{record.timestamp}</span>
                </span>
              </div>

              {billItem && (
                <div className="mt-2 text-xs text-navy-300">
                  关联票据：
                  <span className="font-mono text-navy-500 font-semibold">{billItem.billNo}</span>
                  <span className="ml-2">金额：</span>
                  <span className="font-mono text-navy-500">{billItem.amount.toFixed(2)}</span>
                </div>
              )}

              <DiffViewer before={record.beforeSnapshot} after={record.afterSnapshot} />

              {billItem && (
                <div className="mt-3">
                  <button
                    className="text-xs text-navy-400 hover:text-navy-500 underline underline-offset-2 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation()
                      useBillStore.getState().setSelectedBillId(billItem.id)
                    }}
                  >
                    查看票据详情 →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const PAGE_SIZE = 15

const ACTION_OPTIONS: { value: HistoryAction | ''; label: string }[] = [
  { value: '', label: '全部操作' },
  { value: 'import', label: '导入' },
  { value: 'self_check', label: '自检' },
  { value: 'conflict_resolve', label: '冲突裁决' },
  { value: 'supplement_step', label: '补录步骤' },
  { value: 'risk_review', label: '风控复核' },
  { value: 'export', label: '导出' },
  { value: 'summary_update', label: '摘要更新' },
]

export default function History() {
  const history = useBillStore((s) => s.history)
  const items = useBillStore((s) => s.items)

  const [billNoSearch, setBillNoSearch] = useState('')
  const [actionFilter, setActionFilter] = useState<HistoryAction | ''>('')
  const [dateStart, setDateStart] = useState('')
  const [dateEnd, setDateEnd] = useState('')
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    return history.filter((record) => {
      if (actionFilter && record.action !== actionFilter) return false

      if (billNoSearch.trim()) {
        const billItem = items.find((it) => it.id === record.billItemId)
        if (!billItem || !billItem.billNo.includes(billNoSearch.trim())) return false
      }

      if (dateStart) {
        const recordDate = record.timestamp.slice(0, 10)
        if (recordDate < dateStart) return false
      }
      if (dateEnd) {
        const recordDate = record.timestamp.slice(0, 10)
        if (recordDate > dateEnd) return false
      }

      return true
    })
  }, [history, items, actionFilter, billNoSearch, dateStart, dateEnd])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice(0, page * PAGE_SIZE)

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const loadMore = () => {
    if (page < totalPages) setPage((p) => p + 1)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-shrink-0 bg-white border-b border-navy-100 px-6 py-4">
        <h2 className="text-lg font-bold text-navy-500 mb-3">操作历史</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-200" />
            <input
              type="text"
              placeholder="搜索票据号"
              value={billNoSearch}
              onChange={(e) => { setBillNoSearch(e.target.value); setPage(1) }}
              className="pl-8 pr-3 py-2 text-sm border border-navy-100 rounded-lg bg-navy-50 text-navy-500 placeholder:text-navy-200 focus:outline-none focus:ring-2 focus:ring-navy-200 focus:border-navy-300 w-44 font-mono"
            />
          </div>

          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-navy-200" />
            <select
              value={actionFilter}
              onChange={(e) => { setActionFilter(e.target.value as HistoryAction | ''); setPage(1) }}
              className="pl-8 pr-8 py-2 text-sm border border-navy-100 rounded-lg bg-navy-50 text-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-200 focus:border-navy-300 appearance-none cursor-pointer"
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <Calendar size={14} className="text-navy-200" />
            <input
              type="date"
              value={dateStart}
              onChange={(e) => { setDateStart(e.target.value); setPage(1) }}
              className="px-3 py-2 text-sm border border-navy-100 rounded-lg bg-navy-50 text-navy-500 font-mono focus:outline-none focus:ring-2 focus:ring-navy-200 focus:border-navy-300"
            />
            <span className="text-navy-200 text-sm">至</span>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => { setDateEnd(e.target.value); setPage(1) }}
              className="px-3 py-2 text-sm border border-navy-100 rounded-lg bg-navy-50 text-navy-500 font-mono focus:outline-none focus:ring-2 focus:ring-navy-200 focus:border-navy-300"
            />
          </div>

          {(billNoSearch || actionFilter || dateStart || dateEnd) && (
            <button
              onClick={() => {
                setBillNoSearch('')
                setActionFilter('')
                setDateStart('')
                setDateEnd('')
                setPage(1)
              }}
              className="text-xs text-crimson-500 hover:text-crimson-500 font-medium transition-colors"
            >
              清除筛选
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-5">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-navy-200">
            <Clock size={48} strokeWidth={1} className="mb-4" />
            <p className="text-lg font-medium">暂无操作记录</p>
            <p className="text-sm mt-1">当前筛选条件下没有匹配的历史记录</p>
          </div>
        ) : (
          <>
            <div className="text-xs text-navy-200 mb-4">
              共 {filtered.length} 条记录
            </div>

            <div>
              {paged.map((record) => (
                <TimelineCard
                  key={record.id}
                  record={record}
                  expanded={expandedIds.has(record.id)}
                  onToggle={() => toggleExpand(record.id)}
                />
              ))}
            </div>

            {page * PAGE_SIZE < filtered.length && (
              <div className="flex justify-center pt-4 pb-2">
                <button
                  onClick={loadMore}
                  className="px-6 py-2 text-sm text-navy-300 hover:text-navy-500 border border-navy-100 rounded-lg hover:bg-navy-50 transition-colors"
                >
                  加载更多（剩余 {filtered.length - page * PAGE_SIZE} 条）
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
