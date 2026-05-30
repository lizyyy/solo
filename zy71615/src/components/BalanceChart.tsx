import { useGameStore } from '../store/gameStore'
import { INITIAL_BALANCE } from '../data/scenarios'

export function BalanceChart() {
  const { roundSnapshots, balance } = useGameStore()

  const balances = [
    { round: 0, balance: INITIAL_BALANCE },
    ...roundSnapshots.map(s => ({ round: s.round, balance: s.balance })),
    { round: roundSnapshots.length + 1, balance },
  ]

  if (balances.length <= 1) {
    return (
      <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
        <h3 className="text-amber-400 font-serif text-lg mb-4">余额走势</h3>
        <div className="h-40 flex items-center justify-center text-slate-500">
          暂无数据
        </div>
      </div>
    )
  }

  const minBalance = Math.min(...balances.map(b => b.balance))
  const maxBalance = Math.max(...balances.map(b => b.balance))
  const padding = (maxBalance - minBalance) * 0.1 || 10000
  const yMin = minBalance - padding
  const yMax = maxBalance + padding
  const yRange = yMax - yMin || 1

  const width = 100
  const height = 100
  const points = balances.map((b, i) => {
    const x = (i / (balances.length - 1)) * width
    const y = height - ((b.balance - yMin) / yRange) * height
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
      <h3 className="text-amber-400 font-serif text-lg mb-4">余额走势</h3>
      <div className="h-40 relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
          <polyline
            points={points}
            fill="none"
            stroke="#4ADE80"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
          {balances.map((b, i) => {
            const x = (i / (balances.length - 1)) * width
            const y = height - ((b.balance - yMin) / yRange) * height
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="2"
                fill="#4ADE80"
              />
            )
          })}
        </svg>
      </div>
      <div className="flex justify-between text-xs text-slate-500 mt-2">
        <span>开始</span>
        <span>当前</span>
      </div>
      <div className="mt-3 pt-3 border-t border-slate-700 flex justify-between">
        <div>
          <div className="text-xs text-slate-400">初始余额</div>
          <div className="text-white font-bold">¥{INITIAL_BALANCE.toLocaleString()}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-slate-400">当前余额</div>
          <div className={`font-bold ${balance >= INITIAL_BALANCE ? 'text-green-400' : 'text-red-400'}`}>
            ¥{balance.toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  )
}
