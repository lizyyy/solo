import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { useNavigate } from 'react-router-dom'
import { useRenewalStore } from '@/store/useRenewalStore'
import { STATUS_LABELS, STATUS_COLORS } from '@/types'
import type { RenewalTask } from '@/types'

export default function StatusChart() {
  const navigate = useNavigate()
  const { tasks, getStatusCounts } = useRenewalStore()
  const counts = getStatusCounts()

  const data = (Object.keys(counts) as RenewalTask['status'][]).map((key) => ({
    name: STATUS_LABELS[key],
    value: counts[key],
    status: key,
  }))

  const total = data.reduce((s, d) => s + d.value, 0)

  const handleClick = (status: string) => {
    const task = tasks.find((t) => t.status === status)
    if (task) navigate(`/business-line/${task.id}`)
  }

  return (
    <div className="bg-surface-800 rounded-xl border border-surface-700 p-5">
      <h3 className="text-sm font-medium text-surface-200 mb-4">续保状态总览</h3>
      <div className="relative h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              dataKey="value"
              onClick={(_, index) => handleClick(data[index].status)}
              className="cursor-pointer"
            >
              {data.map((entry, index) => (
                <Cell
                  key={index}
                  fill={STATUS_COLORS[entry.status]}
                  stroke="none"
                  className="hover:opacity-80 transition-opacity"
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#e2e8f0',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-2xl font-bold text-surface-100 font-mono">{total}</p>
            <p className="text-[10px] text-surface-400">总任务</p>
          </div>
        </div>
      </div>
      <div className="flex justify-center gap-4 mt-3">
        {data.map((d) => (
          <div key={d.status} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[d.status] }} />
            <span className="text-[11px] text-surface-400">
              {d.name} {d.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
