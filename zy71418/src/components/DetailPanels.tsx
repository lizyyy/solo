import type { FeeRecalcDetail, CancelRollbackDetail } from '@/types'
import { useState } from 'react'
import { ChevronDown, ChevronRight, Calculator, RotateCcw } from 'lucide-react'

function formatAmount(v: number) {
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function FeeRecalcPanel({ details }: { details: FeeRecalcDetail[] }) {
  const [open, setOpen] = useState(true)

  if (details.length === 0) return null

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-900/60">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-slate-800/40 transition-colors"
      >
        {open ? <ChevronDown size={13} className="text-slate-400" /> : <ChevronRight size={13} className="text-slate-400" />}
        <Calculator size={13} className="text-cyan-400" />
        <span className="text-xs font-semibold text-slate-200">费率重算明细</span>
        <span className="text-[10px] text-slate-500 ml-1">({details.length} 步)</span>
      </button>

      {open && (
        <div className="px-4 pb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700/40">
                <th className="py-1.5 px-2 text-left font-medium">步骤</th>
                <th className="py-1.5 px-2 text-right font-medium">重算前费率</th>
                <th className="py-1.5 px-2 text-right font-medium">重算后费率</th>
                <th className="py-1.5 px-2 text-right font-medium">重算前费用</th>
                <th className="py-1.5 px-2 text-right font-medium">重算后费用</th>
                <th className="py-1.5 px-2 text-left font-medium">原因</th>
                <th className="py-1.5 px-2 text-left font-medium">时间</th>
              </tr>
            </thead>
            <tbody>
              {details.map(d => (
                <tr key={d.id} className="border-b border-slate-800/40">
                  <td className="py-2 px-2 font-mono-amount text-slate-400">{d.step}</td>
                  <td className="py-2 px-2 text-right font-mono-amount text-slate-400">{d.beforeRate}</td>
                  <td className="py-2 px-2 text-right font-mono-amount text-cyan-400">{d.afterRate}</td>
                  <td className="py-2 px-2 text-right font-mono-amount text-slate-400">¥{formatAmount(d.beforeFee)}</td>
                  <td className="py-2 px-2 text-right font-mono-amount text-cyan-300">¥{formatAmount(d.afterFee)}</td>
                  <td className="py-2 px-2 text-slate-300 max-w-[200px]">{d.reason}</td>
                  <td className="py-2 px-2 text-slate-500 font-mono-amount text-[10px]">
                    {new Date(d.timestamp).toLocaleTimeString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function CancelRollbackPanel({ details }: { details: CancelRollbackDetail[] }) {
  const [open, setOpen] = useState(true)

  if (details.length === 0) return null

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-900/60">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-slate-800/40 transition-colors"
      >
        {open ? <ChevronDown size={13} className="text-slate-400" /> : <ChevronRight size={13} className="text-slate-400" />}
        <RotateCcw size={13} className="text-amber-400" />
        <span className="text-xs font-semibold text-slate-200">取消回滚明细</span>
        <span className="text-[10px] text-slate-500 ml-1">({details.length} 步)</span>
      </button>

      {open && (
        <div className="px-4 pb-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-slate-700/40">
                <th className="py-1.5 px-2 text-left font-medium">步骤</th>
                <th className="py-1.5 px-2 text-right font-medium">回滚前费用</th>
                <th className="py-1.5 px-2 text-right font-medium">回滚后费用</th>
                <th className="py-1.5 px-2 text-left font-medium">回滚原因</th>
                <th className="py-1.5 px-2 text-left font-medium">时间</th>
              </tr>
            </thead>
            <tbody>
              {details.map(d => (
                <tr key={d.id} className="border-b border-slate-800/40">
                  <td className="py-2 px-2 font-mono-amount text-slate-400">{d.step}</td>
                  <td className="py-2 px-2 text-right font-mono-amount text-slate-400">¥{formatAmount(d.beforeFee)}</td>
                  <td className="py-2 px-2 text-right font-mono-amount text-amber-300">¥{formatAmount(d.afterFee)}</td>
                  <td className="py-2 px-2 text-slate-300 max-w-[260px]">{d.rollbackReason}</td>
                  <td className="py-2 px-2 text-slate-500 font-mono-amount text-[10px]">
                    {new Date(d.timestamp).toLocaleTimeString('zh-CN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export { FeeRecalcPanel, CancelRollbackPanel }
