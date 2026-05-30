import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useNavigate } from 'react-router-dom'
import { useRenewalStore } from '@/store/useRenewalStore'
import { EXCEPTION_LABELS } from '@/types'
import type { ExceptionType } from '@/types'

const EXCEPTION_COLORS: Record<ExceptionType, string> = {
  claim_missing: '#ef4444',
  discount_error: '#f97316',
  quote_overwrite: '#eab308',
  channel_conflict: '#a855f7',
}

export default function ExceptionChart() {
  const navigate = useNavigate()
  const { tasks, getExceptionCounts } = useRenewalStore()
  const counts = getExceptionCounts()

  const data = (Object.keys(counts) as ExceptionType[]).map((key) => ({
    name: EXCEPTION_LABELS[key],
    value: counts[key],
    type: key,
  }))

  const handleClick = (_: unknown, index: number) => {
    const type = data[index].type
    const task = tasks.find((t) => t.exceptionTypes.includes(type))
    if (task) navigate(`/business-line/${task.id}`)
  }

  return (
    <div className="bg-surface-800 rounded-xl border border-surface-700 p-5">
      <h3 className="text-sm font-medium text-surface-200 mb-4">异常类型分布</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            onClick={handleClick}
            className="cursor-pointer"
          >
            <XAxis
              type="number"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={72}
            />
            <Tooltip
              contentStyle={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#e2e8f0',
              }}
            />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={EXCEPTION_COLORS[entry.type]}
                  className="hover:opacity-80 transition-opacity"
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
