import type { BrokerRateEvidence } from '@/types'
import { AlertTriangle } from 'lucide-react'

interface Props {
  evidence: BrokerRateEvidence
}

function formatAmount(v: number) {
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function RateEvidence({ evidence }: Props) {
  return (
    <div className="rounded-lg border border-rose-500/30 bg-rose-950/20 p-4">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle size={14} className="text-rose-400" />
        <h3 className="text-xs font-semibold text-rose-300">费率证据（撮合与成交回报结论不一致）</h3>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-3">
        <div>
          <div className="text-[10px] text-slate-500 mb-0.5">费率版本</div>
          <div className="text-xs font-mono-amount text-slate-200 font-medium">{evidence.rateVersion}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 mb-0.5">生效时间</div>
          <div className="text-xs font-mono-amount text-slate-200">{new Date(evidence.effectiveTime).toLocaleString('zh-CN')}</div>
        </div>
        <div>
          <div className="text-[10px] text-slate-500 mb-0.5">费率值</div>
          <div className="text-xs font-mono-amount text-slate-200">{evidence.rateValue}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded bg-slate-900/60 border border-slate-700/50 p-3">
          <div className="text-[10px] text-slate-500 mb-1">撮合订单结论</div>
          <div className="text-xs text-slate-300">{evidence.matchingConclusion}</div>
        </div>
        <div className="rounded bg-slate-900/60 border border-slate-700/50 p-3">
          <div className="text-[10px] text-slate-500 mb-1">成交回报结论</div>
          <div className="text-xs text-slate-300">{evidence.tradeReportConclusion}</div>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-700/40">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          <span className="text-[10px] text-rose-300">经纪商费率作为补充证据：确认使用 {evidence.rateVersion} 版本费率</span>
        </div>
      </div>
    </div>
  )
}
