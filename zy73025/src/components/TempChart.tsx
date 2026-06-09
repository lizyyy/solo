import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Scatter,
  ZAxis,
} from 'recharts'
import type { TempPoint, TempThreshold } from '@shared/types'

interface TempChartProps {
  tempCurve: TempPoint[]
  tempThreshold: TempThreshold
}

function formatTime(t: number) {
  const d = new Date(t)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function TempChart({ tempCurve, tempThreshold }: TempChartProps) {
  const { min, max } = tempThreshold
  const data = tempCurve.map((p) => ({
    ...p,
    label: formatTime(p.t),
    over: p.value < min || p.value > max,
    size: 40,
  }))

  return (
    <div className="h-[260px] w-full rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-slate-800">温控曲线</h4>
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1">
            <span className="h-1 w-4 rounded-full border-t-2 border-dashed border-rose-400" />
            阈值 {min}~{max}℃
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height="92%">
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
            domain={[Math.floor(min - 1), Math.ceil(max + 1)]}
            unit="℃"
          />
          <ZAxis dataKey="size" range={[40, 40]} />
          <Tooltip
            labelClassName="text-xs font-medium text-slate-700"
            formatter={(val: number) => [`${val.toFixed(1)}℃`, '温度']}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              fontSize: 12,
              boxShadow: '0 4px 10px -4px rgba(0,0,0,.08)',
            }}
          />
          <ReferenceLine y={min} stroke="#f43f5e" strokeDasharray="4 4" strokeWidth={1.5} />
          <ReferenceLine y={max} stroke="#f43f5e" strokeDasharray="4 4" strokeWidth={1.5} />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#047857"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 5, fill: '#047857', stroke: '#fff', strokeWidth: 2 }}
          />
          <Scatter dataKey="value" isAnimationActive={false}>
            {data.map((entry, index) => (
              <circle
                key={`dot-${index}`}
                cx={0}
                cy={0}
                r={3.5}
                fill={entry.over ? '#e11d48' : '#047857'}
                stroke="#fff"
                strokeWidth={1.5}
              />
            ))}
          </Scatter>
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
