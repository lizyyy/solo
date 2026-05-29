import { useStore } from '@/store'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useState } from 'react'

const granularityOptions = [
  { label: '30分钟', value: 30 },
  { label: '1小时', value: 60 },
]

function formatTime(ts: string): string {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a2332] border border-[#2a3a4d] rounded-md px-3 py-2 shadow-xl">
      <p className="text-[10px] text-[#6b7f94] font-['JetBrains_Mono'] mb-1">{label}</p>
      <p className="text-xs text-[#00D9A6]">
        平均耗时: {payload[0]?.value?.toFixed(0)}ms
      </p>
      <p className="text-xs text-[#F5A623]">
        平均扫描行: {payload[1]?.value ? (payload[1].value / 1000).toFixed(0) + 'K' : '0'}
      </p>
      <p className="text-xs text-[#4A9EFF]">
        查询数: {payload[2]?.value ?? 0}
      </p>
    </div>
  )
}

export default function TrendChart() {
  const trendData = useStore((s) => s.trendData)
  const [metric, setMetric] = useState<'exec' | 'scan'>('exec')

  const data = trendData.map((p) => ({
    ...p,
    time: formatTime(p.timestamp),
    execTime: p.avg_exec_time_ms,
    scanRows: p.avg_scan_rows,
    count: p.count,
  }))

  return (
    <div className="bg-[#141b22] rounded-lg border border-[#1e2a36] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1e2a36] flex items-center justify-between">
        <h3 className="text-xs font-semibold text-[#a0b3c6] uppercase tracking-wider">
          慢查询趋势
        </h3>
        <div className="flex items-center gap-1 bg-[#0a0e12] rounded-md p-0.5">
          <button
            className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
              metric === 'exec' ? 'bg-[#00D9A6]/15 text-[#00D9A6]' : 'text-[#6b7f94] hover:text-[#a0b3c6]'
            }`}
            onClick={() => setMetric('exec')}
          >
            执行时间
          </button>
          <button
            className={`px-2 py-1 rounded text-[10px] font-medium transition-all ${
              metric === 'scan' ? 'bg-[#F5A623]/15 text-[#F5A623]' : 'text-[#6b7f94] hover:text-[#a0b3c6]'
            }`}
            onClick={() => setMetric('scan')}
          >
            扫描行数
          </button>
        </div>
      </div>

      <div className="px-2 py-3 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gradExec" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00D9A6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#00D9A6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradScan" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F5A623" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#F5A623" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2a36" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: '#4a5f75' }}
              axisLine={{ stroke: '#1e2a36' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#4a5f75' }}
              axisLine={{ stroke: '#1e2a36' }}
              tickLine={false}
              tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`}
            />
            <Tooltip content={<CustomTooltip />} />

            {metric === 'exec' ? (
              <Area
                type="monotone"
                dataKey="execTime"
                stroke="#00D9A6"
                fill="url(#gradExec)"
                strokeWidth={2}
                dot={{ r: 3, fill: '#00D9A6', stroke: '#0F1419', strokeWidth: 2 }}
                activeDot={{ r: 5, fill: '#00D9A6', stroke: '#0F1419', strokeWidth: 2 }}
              />
            ) : (
              <Area
                type="monotone"
                dataKey="scanRows"
                stroke="#F5A623"
                fill="url(#gradScan)"
                strokeWidth={2}
                dot={{ r: 3, fill: '#F5A623', stroke: '#0F1419', strokeWidth: 2 }}
                activeDot={{ r: 5, fill: '#F5A623', stroke: '#0F1419', strokeWidth: 2 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
