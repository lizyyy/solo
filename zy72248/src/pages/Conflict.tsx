import { useState } from 'react'
import { ShieldAlert, CheckCircle2, XCircle, AlertTriangle, FileText, Hash, Scale } from 'lucide-react'
import { useBillStore } from '@/store/billStore'
import { STATUS_LABELS } from '@/types'
import type { ConflictResolution, ConflictEvidence } from '@/types'
import { cn } from '@/lib/utils'

type FilterTab = 'all' | 'unresolved' | 'resolved'

const RESOLUTION_LABELS: Record<ConflictResolution, string> = {
  tax_remark: '以税费率备注为准',
  counter_tail: '以柜台流水尾号为准',
  rejected: '驳回（需补材料）',
}

const RESOLUTION_ICONS: Record<ConflictResolution, typeof CheckCircle2> = {
  tax_remark: CheckCircle2,
  counter_tail: CheckCircle2,
  rejected: XCircle,
}

function ConflictCard({ conflict }: { conflict: ConflictEvidence }) {
  const items = useBillStore((s) => s.items)
  const resolveConflict = useBillStore((s) => s.resolveConflict)
  const billItem = items.find((it) => it.id === conflict.billItemId)
  const [resolving, setResolving] = useState<string | null>(null)

  if (!billItem) return null

  const handleResolve = (resolution: ConflictResolution) => {
    setResolving(resolution)
    setTimeout(() => {
      resolveConflict(conflict.id, resolution, '阿芬')
      setResolving(null)
    }, 300)
  }

  return (
    <div
      className={cn(
        'rounded-lg border bg-white shadow-sm transition-all duration-300',
        conflict.resolved ? 'border-emerald-200 opacity-80' : 'border-amber-300'
      )}
    >
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50/60 rounded-t-lg">
        <FileText size={15} className="text-navy-300" />
        <span className="font-mono text-sm font-semibold text-navy-700">{billItem.billNo}</span>
        <span className="text-gray-300">|</span>
        <span className="font-mono text-sm text-navy-500">¥{billItem.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</span>
        <span className="text-gray-300">|</span>
        <span
          className={cn(
            'inline-flex items-center rounded px-2 py-0.5 text-xs font-medium',
            billItem.status === 'conflict'
              ? 'bg-amber-100 text-amber-700'
              : billItem.status === 'supplement'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-crimson-100 text-crimson-700'
          )}
        >
          {STATUS_LABELS[billItem.status]}
        </span>
      </div>

      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={14} className="text-amber-500" />
          <span className="text-xs font-medium text-amber-600">冲突字段：{conflict.field}</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-navy-100 bg-navy-50/40 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Hash size={13} className="text-navy-400" />
              <span className="text-xs font-medium text-navy-500">税费率备注</span>
            </div>
            <span className={cn(
              'font-mono text-xl font-bold',
              !conflict.resolved ? 'bg-amber-100 text-amber-700 px-2 py-0.5 rounded' : 'text-navy-700'
            )}>
              {conflict.taxRateValue}
            </span>
          </div>

          <div className="rounded-lg border border-navy-100 bg-navy-50/40 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Hash size={13} className="text-navy-400" />
              <span className="text-xs font-medium text-navy-500">柜台流水尾号</span>
            </div>
            <span className={cn(
              'font-mono text-xl font-bold',
              !conflict.resolved ? 'bg-amber-100 text-amber-700 px-2 py-0.5 rounded' : 'text-navy-700'
            )}>
              {conflict.counterTxnValue}
            </span>
          </div>
        </div>
      </div>

      {!conflict.resolved ? (
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/40 flex items-center gap-3">
          <button
            onClick={() => handleResolve('tax_remark')}
            disabled={resolving !== null}
            className={cn(
              'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-all',
              resolving === 'tax_remark'
                ? 'bg-emerald-200 text-emerald-800'
                : 'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95',
              resolving !== null && resolving !== 'tax_remark' && 'opacity-40 cursor-not-allowed'
            )}
          >
            <Scale size={13} />
            确认以税费率备注为准
          </button>
          <button
            onClick={() => handleResolve('counter_tail')}
            disabled={resolving !== null}
            className={cn(
              'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-all',
              resolving === 'counter_tail'
                ? 'bg-emerald-200 text-emerald-800'
                : 'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95',
              resolving !== null && resolving !== 'counter_tail' && 'opacity-40 cursor-not-allowed'
            )}
          >
            <Scale size={13} />
            确认以柜台流水尾号为准
          </button>
          <button
            onClick={() => handleResolve('rejected')}
            disabled={resolving !== null}
            className={cn(
              'inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-semibold transition-all',
              resolving === 'rejected'
                ? 'bg-crimson-200 text-crimson-800'
                : 'bg-crimson-500 text-white hover:bg-crimson-600 active:scale-95',
              resolving !== null && resolving !== 'rejected' && 'opacity-40 cursor-not-allowed'
            )}
          >
            <XCircle size={13} />
            驳回（需补材料）
          </button>
        </div>
      ) : (
        <div
          className={cn(
            'px-5 py-3 border-t flex items-center gap-2 text-xs',
            conflict.resolution === 'rejected'
              ? 'border-crimson-100 bg-crimson-50 text-crimson-600'
              : 'border-emerald-100 bg-emerald-50 text-emerald-600'
          )}
        >
          {(() => {
            const Icon = RESOLUTION_ICONS[conflict.resolution!]
            return <Icon size={14} />
          })()}
          <span className="font-medium">
            已裁决：{RESOLUTION_LABELS[conflict.resolution!]}
          </span>
          {conflict.resolvedBy && (
            <>
              <span className="opacity-40">·</span>
              <span>操作人：{conflict.resolvedBy}</span>
            </>
          )}
          {conflict.resolvedAt && (
            <>
              <span className="opacity-40">·</span>
              <span className="font-mono">{conflict.resolvedAt}</span>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function Conflict() {
  const conflicts = useBillStore((s) => s.conflicts)
  const [filter, setFilter] = useState<FilterTab>('unresolved')

  const unresolvedCount = conflicts.filter((c) => !c.resolved).length
  const resolvedCount = conflicts.filter((c) => c.resolved).length

  const filtered = conflicts.filter((c) => {
    if (filter === 'unresolved') return !c.resolved
    if (filter === 'resolved') return c.resolved
    return true
  })

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: '全部', count: conflicts.length },
    { key: 'unresolved', label: '未裁决', count: unresolvedCount },
    { key: 'resolved', label: '已裁决', count: resolvedCount },
  ]

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-navy-500 text-white">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-navy-700">冲突裁决</h1>
            <p className="text-xs text-navy-300 mt-0.5">税费率备注与柜台流水尾号数据矛盾时的裁决处理</p>
          </div>
        </div>
        {unresolvedCount > 0 && (
          <div className="flex items-center gap-1.5 bg-amber-100 text-amber-700 px-3 py-1.5 rounded-lg text-sm font-semibold">
            <AlertTriangle size={15} />
            <span>{unresolvedCount} 条待裁决</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 mb-5 bg-gray-100 rounded-lg p-1 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-all',
              filter === tab.key
                ? 'bg-white text-navy-700 shadow-sm'
                : 'text-navy-300 hover:text-navy-500'
            )}
          >
            {tab.label}
            <span
              className={cn(
                'ml-1.5 text-xs font-mono',
                filter === tab.key ? 'text-amber-500' : 'text-navy-200'
              )}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-navy-300">
          <ShieldAlert size={48} strokeWidth={1} className="mb-3 opacity-30" />
          <p className="text-sm font-medium">
            {filter === 'unresolved'
              ? '暂无待裁决冲突'
              : filter === 'resolved'
                ? '暂无已裁决记录'
                : '暂无冲突记录'}
          </p>
          <p className="text-xs mt-1 opacity-60">数据一致，无需裁决</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filtered.map((conflict) => (
            <ConflictCard key={conflict.id} conflict={conflict} />
          ))}
        </div>
      )}
    </div>
  )
}
