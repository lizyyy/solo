import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { CostAllocationResult } from '@/store'

interface CostChartProps {
  results: CostAllocationResult[]
  onSelect: (result: CostAllocationResult) => void
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-lg px-3 py-2 shadow-xl text-sm">
      <p className="text-slate-300">样本: {data.displayId}</p>
      <p className="text-slate-300">分摊成本: {data.allocatedCost.toFixed(2)}</p>
      {data.isBoundary && <p className="text-rose-400">边界样本</p>}
    </div>
  )
}

export default function CostChart({ results, onSelect }: CostChartProps) {
  if (results.length === 0) {
    return (
      <div className="w-full h-[500px] flex items-center justify-center text-slate-500">
        <p>暂无计算结果数据</p>
      </div>
    )
  }

  const data = results.map((r, i) => ({
    ...r,
    displayId: (r.recordId ?? r.id).length > 6 ? (r.recordId ?? r.id).slice(0, 6) + '...' : (r.recordId ?? r.id),
  }))

  return (
    <div className="w-full h-[500px] rounded-xl overflow-hidden border border-slate-700/50 bg-slate-800/30 p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} onClick={(e) => {
          if (e?.activePayload?.[0]) {
            onSelect(e.activePayload[0].payload)
          }
        }}>
          <XAxis dataKey="displayId" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={{ stroke: '#334155' }} />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={{ stroke: '#334155' }} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148, 163, 184, 0.05)' }} />
          <Bar dataKey="allocatedCost" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={entry.isBoundary ? '#ef4444' : '#475569'}
                stroke={entry.isBoundary ? '#ef4444' : '#475569'}
                strokeWidth={entry.isBoundary ? 2 : 0}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
