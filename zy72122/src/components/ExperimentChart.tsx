import { useStore } from '@/store/useStore'

import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'

export default function ExperimentChart() {
  const records = useStore((s) => s.records)
  const validationResults = useStore((s) => s.validationResults)
  const config = useStore((s) => s.config)

  const sorted = [...records].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  const chartData = sorted.map((r, idx) => {
    const vr = validationResults.find((v) => v.recordId === r.id)
    const overThreshold = vr ? vr.status === 'error' : false
    const confirmed = !!r.reviewNote
    return {
      name: `#${idx + 1}`,
      displacement: r.displacement,
      force: r.force,
      overThreshold,
      confirmed,
      timestamp: r.timestamp,
    }
  })

  const forceDisplacementData = sorted.map((r) => {
    const vr = validationResults.find((v) => v.recordId === r.id)
    const overThreshold = vr ? vr.status === 'error' : false
    const confirmed = !!r.reviewNote
    return {
      displacement: r.displacement,
      force: r.force,
      overThreshold,
      confirmed,
    }
  })

  if (records.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        暂无数据，请先录入实验记录
      </div>
    )
  }

  const normalPoints = forceDisplacementData.filter((d) => !d.overThreshold)
  const anomalyUnconfirmed = forceDisplacementData.filter((d) => d.overThreshold && !d.confirmed)
  const anomalyConfirmed = forceDisplacementData.filter((d) => d.overThreshold && d.confirmed)

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-3 text-sm font-medium text-slate-300">
          力-位移关系图
        </h3>
        <div className="h-72 rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={forceDisplacementData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="displacement"
                type="number"
                name="位移"
                unit="mm"
                stroke="#94a3b8"
                fontSize={11}
              />
              <YAxis
                name="力"
                unit="N"
                stroke="#94a3b8"
                fontSize={11}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <ReferenceLine
                y={config.forceThresholdMax}
                stroke="#ef4444"
                strokeDasharray="5 5"
                label={{
                  value: `安全上限 ${config.forceThresholdMax}N`,
                  fill: '#ef4444',
                  fontSize: 10,
                }}
              />
              <ReferenceLine
                y={config.forceThresholdMin}
                stroke="#ef4444"
                strokeDasharray="5 5"
                label={{
                  value: `安全下限 ${config.forceThresholdMin}N`,
                  fill: '#ef4444',
                  fontSize: 10,
                }}
              />
              {normalPoints.length > 0 && (
                <Scatter
                  name="正常记录"
                  data={normalPoints}
                  dataKey="force"
                  fill="#22c55e"
                  r={5}
                />
              )}
              {anomalyUnconfirmed.length > 0 && (
                <Scatter
                  name="超阈值（待确认）"
                  data={anomalyUnconfirmed}
                  dataKey="force"
                  fill="#f97316"
                  r={7}
                  shape="diamond"
                />
              )}
              {anomalyConfirmed.length > 0 && (
                <Scatter
                  name="超阈值（已确认）"
                  data={anomalyConfirmed}
                  dataKey="force"
                  fill="#3b82f6"
                  r={7}
                  shape="triangle"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-sm font-medium text-slate-300">
          时间序列图（力随时间变化）
        </h3>
        <div className="h-72 rounded-lg border border-slate-700/50 bg-slate-800/30 p-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="name"
                stroke="#94a3b8"
                fontSize={11}
              />
              <YAxis
                name="力"
                unit="N"
                stroke="#94a3b8"
                fontSize={11}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1e293b',
                  border: '1px solid #475569',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <ReferenceLine
                y={config.forceThresholdMax}
                stroke="#ef4444"
                strokeDasharray="5 5"
                label={{
                  value: `安全上限 ${config.forceThresholdMax}N`,
                  fill: '#ef4444',
                  fontSize: 10,
                }}
              />
              <Line
                type="monotone"
                dataKey="force"
                name="力(N)"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={(props: Record<string, unknown>) => {
                  const { cx, cy, payload } = props as {
                    cx: number
                    cy: number
                    payload: { overThreshold: boolean; confirmed: boolean }
                  }
                  const isOver = payload.overThreshold
                  const isConfirmed = payload.confirmed
                  let fill = '#3b82f6'
                  let r = 3
                  if (isOver && isConfirmed) { fill = '#3b82f6'; r = 5 }
                  else if (isOver) { fill = '#f97316'; r = 6 }
                  return (
                    <circle
                      key={`dot-${cx}-${cy}`}
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill={fill}
                      stroke={fill}
                    />
                  )
                }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          正常记录
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rotate-45 bg-orange-500" />
          超阈值（待确认）
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0 w-0 border-l-[5px] border-r-[5px] border-b-[8px] border-l-transparent border-r-transparent border-b-blue-500" />
          超阈值（已确认）
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0 w-6 border-t-2 border-dashed border-red-500" />
          安全阈值
        </div>
      </div>
    </div>
  )
}
