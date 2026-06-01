import { useStore } from '@/store/useStore'
import { DEFAULT_CONFIG } from '@/types'
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
  const config = useStore((s) => s.config)

  const sorted = [...records].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  const chartData = sorted.map((r, idx) => ({
    name: `#${idx + 1}`,
    displacement: r.displacement,
    force: r.force,
    status: r.status,
    timestamp: r.timestamp,
    isAnomaly: r.status !== 'passed',
  }))

  const forceDisplacementData = sorted.map((r) => ({
    displacement: r.displacement,
    force: r.force,
    status: r.status,
    isAnomaly: r.status !== 'passed',
  }))

  if (records.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-slate-500">
        暂无数据，请先录入实验记录
      </div>
    )
  }

  const normalPoints = forceDisplacementData.filter((d) => !d.isAnomaly)
  const anomalyPoints = forceDisplacementData.filter((d) => d.isAnomaly)

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
              {anomalyPoints.length > 0 && (
                <Scatter
                  name="异常记录"
                  data={anomalyPoints}
                  dataKey="force"
                  fill="#f97316"
                  r={7}
                  shape="diamond"
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
                    payload: { isAnomaly: boolean }
                  }
                  return (
                    <circle
                      key={`dot-${cx}-${cy}`}
                      cx={cx}
                      cy={cy}
                      r={payload.isAnomaly ? 6 : 3}
                      fill={payload.isAnomaly ? '#f97316' : '#3b82f6'}
                      stroke={payload.isAnomaly ? '#f97316' : '#3b82f6'}
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
          异常记录
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-0 w-6 border-t-2 border-dashed border-red-500" />
          安全阈值
        </div>
      </div>
    </div>
  )
}
