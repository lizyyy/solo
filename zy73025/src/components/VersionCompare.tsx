import { ArrowRightLeft, ArrowRight } from 'lucide-react'
import type { TempRecord, Conclusion, RecordStatus } from '@shared/types'
import StatusBadge from './StatusBadge'
import { cn } from '@/lib/utils'

interface VersionCompareProps {
  oldSnapshot: Partial<TempRecord>
  newSnapshot: Partial<TempRecord>
}

type DiffKey = 'conclusion' | 'status' | 'factors' | 'pendingReason' | 'notes'

const DIFF_KEYS: DiffKey[] = ['conclusion', 'status', 'factors', 'pendingReason', 'notes']

const KEY_LABEL: Record<DiffKey, string> = {
  conclusion: '结论',
  status: '状态',
  factors: '影响因子',
  pendingReason: '待确认理由',
  notes: '备注数',
}

function normalize<T>(key: DiffKey, val: T | undefined): string {
  if (val === undefined || val === null) return '—'
  if (key === 'factors') return Array.isArray(val) ? `${val.length} 项` : '—'
  if (key === 'notes') return Array.isArray(val) ? `${val.length} 条` : '—'
  return String(val)
}

function renderBadge(key: DiffKey, val: string, kind: 'old' | 'new') {
  if (key === 'conclusion') {
    const valid = ['normal', 'observe', 'abnormal'] as Conclusion[]
    if (valid.includes(val as Conclusion)) {
      return <StatusBadge conclusion={val as Conclusion} />
    }
  }
  if (key === 'status') {
    const valid = ['pending', 'confirmed', 'exception'] as RecordStatus[]
    if (valid.includes(val as RecordStatus)) {
      return <StatusBadge status={val as RecordStatus} />
    }
  }
  return (
    <span
      className={cn(
        'inline-block rounded-md px-2 py-0.5 text-xs font-medium',
        kind === 'old'
          ? 'bg-rose-50 text-rose-600 ring-1 ring-rose-200 line-through'
          : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 font-semibold',
      )}
    >
      {val}
    </span>
  )
}

export default function VersionCompare({ oldSnapshot, newSnapshot }: VersionCompareProps) {
  const diffs = DIFF_KEYS.filter((k) => {
    const a = normalize(k, (oldSnapshot as Record<string, unknown>)[k])
    const b = normalize(k, (newSnapshot as Record<string, unknown>)[k])
    return a !== b
  })

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
        <ArrowRightLeft className="h-4 w-4 text-slate-500" />
        <h4 className="text-sm font-semibold text-slate-800">材料对比：变更点</h4>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
          {diffs.length} 处差异
        </span>
      </div>

      {diffs.length === 0 ? (
        <div className="px-4 py-10 text-center text-xs text-slate-400">无实质差异</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {diffs.map((k) => {
            const oldVal = normalize(k, (oldSnapshot as Record<string, unknown>)[k])
            const newVal = normalize(k, (newSnapshot as Record<string, unknown>)[k])
            return (
              <div key={k} className="grid grid-cols-12 gap-3 px-4 py-3 text-xs">
                <div className="col-span-2 flex items-center gap-1 text-slate-500">
                  <span className="font-medium">{KEY_LABEL[k]}</span>
                </div>
                <div className="col-span-4 flex items-center gap-1.5">
                  {k === 'conclusion' || k === 'status' ? (
                    renderBadge(k, oldVal, 'old')
                  ) : (
                    <span className="rounded-md bg-rose-50 px-2 py-0.5 text-rose-600 ring-1 ring-rose-200 line-through">
                      {oldVal}
                    </span>
                  )}
                </div>
                <div className="col-span-1 flex items-center justify-center">
                  <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                </div>
                <div className="col-span-5 flex items-center gap-1.5">
                  {k === 'conclusion' || k === 'status' ? (
                    renderBadge(k, newVal, 'new')
                  ) : (
                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      {newVal}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
