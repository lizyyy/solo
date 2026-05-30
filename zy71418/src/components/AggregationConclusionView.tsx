import type { AggregationConclusion } from '@/types'
import { CheckCircle2, AlertCircle } from 'lucide-react'

interface Props {
  conclusion: AggregationConclusion
  diffAmount: number
}

function formatAmount(v: number) {
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function AggregationConclusionView({ conclusion, diffAmount }: Props) {
  const isZero = conclusion.conclusionAmount === 0 && diffAmount === 0
  const isPositive = conclusion.conclusionAmount > 0

  return (
    <div className={`rounded-lg border p-4 ${
      isZero
        ? 'bg-emerald-950/20 border-emerald-500/30'
        : isPositive
          ? 'bg-amber-950/20 border-amber-500/30'
          : 'bg-slate-900/60 border-slate-700/50'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {isZero ? (
            <CheckCircle2 size={14} className="text-emerald-400" />
          ) : (
            <AlertCircle size={14} className="text-amber-400" />
          )}
          <h3 className="text-xs font-semibold text-slate-200">归集结论</h3>
        </div>
        <div className="font-mono-amount text-sm font-semibold">
          {isZero ? (
            <span className="text-emerald-400">¥0.00（无差异）</span>
          ) : (
            <span className={isPositive ? 'text-amber-400' : 'text-slate-300'}>
              ¥{formatAmount(conclusion.conclusionAmount)}
            </span>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-400 leading-relaxed mb-3">
        {conclusion.logicDescription}
      </p>

      <div className="flex items-center gap-4 pt-2 border-t border-slate-700/40">
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${conclusion.corroboratedByRecalc ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          <span className="text-[10px] text-slate-400">
            费率重算印证 {conclusion.corroboratedByRecalc ? '✓' : '—'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${conclusion.corroboratedByRollback ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          <span className="text-[10px] text-slate-400">
            取消回滚印证 {conclusion.corroboratedByRollback ? '✓' : '—'}
          </span>
        </div>
      </div>
    </div>
  )
}
