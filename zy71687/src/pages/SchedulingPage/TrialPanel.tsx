import { useStore } from '@/store/useStore'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from 'recharts'
import { cn } from '@/lib/utils'

function formatCNY(v: number): string {
  return `¥${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface CustomTooltipProps {
  active?: boolean
  payload?: { name: string; value: number; payload: { planId: string; currency: string } }[]
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  return (
    <div className="bg-[#1a1f2e] border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <div className="text-white/60 mb-1">{data.planId} · {data.currency}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', p.name === 'lockedCNY' ? 'bg-emerald-400' : 'bg-sky-400')} />
          <span className="text-white/50">{p.name === 'lockedCNY' ? '锁汇' : '即期'}</span>
          <span className="text-white/90 ml-auto">{formatCNY(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function TrialPanel() {
  const { trialResult } = useStore()

  if (!trialResult) {
    return (
      <div className="bg-[#1a1f2e] rounded-xl border border-white/5 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white/90">试算对比</h2>
        </div>
        <div className="py-12 text-center text-white/20 text-xs">请先执行排程试算</div>
      </div>
    )
  }

  const chartData = trialResult.perPlan.map((p) => ({
    ...p,
    lockedCNY: Math.round(p.lockedCNY * 100) / 100,
    spotCNY: Math.round(p.spotCNY * 100) / 100,
  }))

  return (
    <div className="bg-[#1a1f2e] rounded-xl border border-white/5 overflow-hidden">
      <div className="px-5 py-3 border-b border-white/5">
        <h2 className="text-sm font-semibold text-white/90">试算对比</h2>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-emerald-500/8 border border-emerald-500/20 rounded-lg p-4">
            <div className="text-[10px] text-emerald-400/70 mb-1">锁汇结汇</div>
            <div className="text-lg font-bold text-emerald-400">{formatCNY(trialResult.lockedTotalCNY)}</div>
          </div>
          <div className="bg-sky-500/8 border border-sky-500/20 rounded-lg p-4">
            <div className="text-[10px] text-sky-400/70 mb-1">即期结汇</div>
            <div className="text-lg font-bold text-sky-400">{formatCNY(trialResult.spotTotalCNY)}</div>
          </div>
          <div
            className={cn(
              'rounded-lg p-4 border',
              trialResult.savings >= 0
                ? 'bg-emerald-500/8 border-emerald-500/20'
                : 'bg-red-500/8 border-red-500/20'
            )}
          >
            <div
              className={cn(
                'text-[10px] mb-1 flex items-center gap-1',
                trialResult.savings >= 0 ? 'text-emerald-400/70' : 'text-red-400/70'
              )}
            >
              {trialResult.savings >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              锁汇节省
            </div>
            <div
              className={cn(
                'text-lg font-bold',
                trialResult.savings >= 0 ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {formatCNY(trialResult.savings)}
            </div>
            <div
              className={cn(
                'text-xs mt-0.5',
                trialResult.savings >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'
              )}
            >
              {trialResult.savingsPercent.toFixed(2)}%
            </div>
          </div>
        </div>

        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="planId"
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }}
                axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                tickLine={false}
                width={50}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="lockedCNY" name="lockedCNY" radius={[2, 2, 0, 0]} barSize={14}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.diff >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.8} />
                ))}
              </Bar>
              <Bar dataKey="spotCNY" name="spotCNY" fill="#38bdf8" fillOpacity={0.5} radius={[2, 2, 0, 0]} barSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
