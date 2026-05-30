import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useNavigate } from 'react-router-dom'
import { useRenewalStore } from '@/store/useRenewalStore'

export default function MatchRateChart() {
  const navigate = useNavigate()
  const { tasks, getMatchRateByChannel } = useRenewalStore()
  const data = getMatchRateByChannel()

  const handleClick = (_: unknown, index: number) => {
    const channel = data[index].channel
    const task = tasks.find((t) => t.quotes.some((q) => q.channel === channel))
    if (task) navigate(`/business-line/${task.id}`)
  }

  return (
    <div className="bg-surface-800 rounded-xl border border-surface-700 p-5">
      <h3 className="text-sm font-medium text-surface-200 mb-4">报价匹配率</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} onClick={handleClick} className="cursor-pointer">
            <XAxis
              dataKey="channel"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={{ stroke: '#334155' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
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
            <Bar dataKey="matched" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} className="hover:opacity-80 transition-opacity" />
              ))}
            </Bar>
            <Bar dataKey="mismatched" stackId="a" fill="#f97316" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} className="hover:opacity-80 transition-opacity" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-accent-green" />
          <span className="text-[11px] text-surface-400">匹配</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-accent-orange" />
          <span className="text-[11px] text-surface-400">偏差</span>
        </div>
      </div>
    </div>
  )
}
