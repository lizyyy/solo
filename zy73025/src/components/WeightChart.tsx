import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import type { WeightPoint } from '@shared/types'
import { cn } from '@/lib/utils'

interface WeightChartProps {
  weightCurve: WeightPoint[]
  hasLegacyCurve?: boolean
}

function formatTime(t: number) {
  const d = new Date(t)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function WeightChart({ weightCurve, hasLegacyCurve = false }: WeightChartProps) {
  const data = weightCurve
    .reduce(
      (acc, p) => {
        const label = formatTime(p.t)
        const existing = acc.find((it) => it.label === label)
        if (existing) {
          if (p.version === 'new') existing.new = p.value
          else existing.legacy = p.value
        } else {
          acc.push({
            label,
            t: p.t,
            new: p.version === 'new' ? p.value : undefined,
            legacy: p.version === 'legacy' ? p.value : undefined,
          })
        }
        return acc
      },
      [] as Array<{ label: string; t: number; new?: number; legacy?: number }>,
    )
    .sort((a, b) => a.t - b.t)

  return (
    <div
      className={cn(
        'relative h-[260px] w-full rounded-2xl border bg-white p-4',
        hasLegacyCurve ? 'border-slate-300 ring-1 ring-slate-200' : 'border-slate-200',
      )}
    >
      {hasLegacyCurve && (
        <div className="legacy-watermark absolute right-3 top-3 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200">
          旧版
        </div>
      )}
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-800">体重曲线</h4>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-1 w-4 rounded-full bg-emerald-700" />
            新版
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-1 w-4 rounded-full border-t-2 border-dashed border-slate-400" />
            旧版
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="88%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            unit="kg"
          />
          <Tooltip
            labelClassName="text-xs font-medium text-slate-700"
            formatter={(val: number, name: string) => [
              `${val.toFixed(2)}kg`,
              name === 'new' ? '新版' : '旧版',
            ]}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              fontSize: 12,
              boxShadow: '0 4px 10px -4px rgba(0,0,0,.08)',
            }}
          />
          <Legend
            formatter={(v) => (v === 'new' ? '新版数据' : '旧版数据')}
            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
            iconType="plainline"
          />
          <Line
            type="monotone"
            dataKey="new"
            stroke="#047857"
            strokeWidth={2.5}
            dot={{ r: 3.5, fill: '#047857', stroke: '#fff', strokeWidth: 1.5 }}
            label={{
              position: 'top',
              fontSize: 9,
              fill: '#047857',
              formatter: (v: number) => (v != null ? v.toFixed(1) : ''),
            }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="legacy"
            stroke="#94a3b8"
            strokeWidth={3}
            strokeDasharray="6 4"
            dot={{ r: 3, fill: '#94a3b8', stroke: '#fff', strokeWidth: 1.5 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
