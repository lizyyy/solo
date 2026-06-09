import { AlertTriangle, FileText, Plus, ClipboardList, Stethoscope } from 'lucide-react'
import type { VaccineRecord } from '@shared/types'
import { cn } from '@/lib/utils'

interface VaccineWarningProps {
  vaccines: VaccineRecord[]
  pendingReason?: string
  affectedRecords: string[]
  onSupplement: () => void
  onSetPending: (reason: string) => void
}

export default function VaccineWarning({
  vaccines,
  pendingReason,
  affectedRecords,
  onSupplement,
  onSetPending,
}: VaccineWarningProps) {
  const missing = vaccines.filter((v) => !v.date)

  const handleSetPending = () => {
    const input = window.prompt('请填写待确认理由：')
    if (input && input.trim().length > 0) {
      onSetPending(input.trim())
    }
  }

  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-rose-900">
            疫苗日期缺失 - 不得直接标记为正常
          </h3>
          <p className="mt-1 text-xs text-rose-600/80">
            以下疫苗缺少接种日期，请补录或填写待确认理由。
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div className="rounded-xl bg-white/70 p-3 ring-1 ring-rose-100">
          <p className="mb-2 text-xs font-semibold text-rose-800">缺失疫苗清单</p>
          <ul className="space-y-1.5">
            {missing.map((v, i) => (
              <li
                key={i}
                className="flex items-center gap-2 rounded-md bg-rose-50 px-2.5 py-1.5 text-xs text-rose-700"
              >
                <Stethoscope className="h-3.5 w-3.5" />
                <span className="font-medium">{v.name}</span>
                <span className="ml-auto text-rose-400">日期缺失</span>
              </li>
            ))}
            {missing.length === 0 && <li className="text-xs text-rose-500/70">无缺失项</li>}
          </ul>
        </div>

        <div className="rounded-xl bg-white/70 p-3 ring-1 ring-rose-100">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-rose-800">
            <ClipboardList className="h-3.5 w-3.5" />
            待确认理由
          </div>
          {pendingReason ? (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-100">
              {pendingReason}
            </div>
          ) : (
            <div className="rounded-md border border-dashed border-rose-200 px-3 py-2 text-xs text-rose-400">
              暂未填写理由
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white/70 p-3 ring-1 ring-rose-100">
          <p className="mb-2 text-xs font-semibold text-rose-800">受影响记录</p>
          <div className="flex flex-wrap gap-1.5">
            {affectedRecords.length > 0 ? (
              affectedRecords.map((id) => (
                <code
                  key={id}
                  className="rounded-md bg-rose-50 px-2 py-1 font-mono text-[11px] text-rose-700 ring-1 ring-rose-100"
                >
                  {id.slice(0, 8)}
                </code>
              ))
            ) : (
              <span className="text-xs text-rose-400">暂无关联记录</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onSupplement}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold',
              'bg-rose-600 text-white shadow-sm hover:bg-rose-700 transition-colors',
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            补录疫苗信息
          </button>
          <button
            onClick={handleSetPending}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold',
              'bg-white text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50 transition-colors',
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            填写待确认理由
          </button>
        </div>
      </div>
    </div>
  )
}
