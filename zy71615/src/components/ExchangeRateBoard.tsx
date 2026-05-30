import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useGameStore } from '../store/gameStore'
import { TRAP_ROUND } from '../data/scenarios'

export function ExchangeRateBoard() {
  const { exchangeRates, currentRound } = useGameStore()
  const current = exchangeRates[exchangeRates.length - 1]
  const history = exchangeRates.slice(-10)

  if (!current) return null

  const minRate = Math.min(...history.map(r => r.rate))
  const maxRate = Math.max(...history.map(r => r.rate))
  const range = maxRate - minRate || 1

  const points = history.map((r, i) => {
    const x = (i / (history.length - 1 || 1)) * 100
    const y = 100 - ((r.rate - minRate) / range) * 100
    return `${x},${y}`
  }).join(' ')

  const isTrapRound = currentRound === TRAP_ROUND
  const isRateDrop = current.direction === 'down'

  return (
    <div className="bg-slate-900 border-2 border-amber-500 rounded-lg p-4 shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-amber-400 font-serif text-lg">USD / CNY</h3>
        {isTrapRound && isRateDrop && (
          <span className="text-xs bg-red-900 text-red-300 px-2 py-1 rounded animate-pulse">
            ⚠️ 汇率下跌中
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-4xl font-bold text-amber-300 font-serif tracking-wider">
          {current.rate.toFixed(4)}
        </span>
        <span className={`flex items-center gap-1 text-lg ${
          current.direction === 'up' ? 'text-green-400' :
          current.direction === 'down' ? 'text-red-400' : 'text-gray-400'
        }`}>
          {current.direction === 'up' && <TrendingUp size={20} />}
          {current.direction === 'down' && <TrendingDown size={20} />}
          {current.direction === 'stable' && <Minus size={20} />}
          <span className="text-sm">
            {current.direction === 'up' ? '+' : ''}
            {(current.rate - current.previousRate).toFixed(4)}
          </span>
        </span>
      </div>
      <div className="h-16 w-full relative">
        <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
          <polyline
            points={points}
            fill="none"
            stroke="#D4A037"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          <circle cx="100" cy={100 - ((current.rate - minRate) / range) * 100} r="3" fill="#D4A037" />
        </svg>
      </div>
      <div className="flex justify-between text-xs text-slate-400 mt-1">
        <span>R{currentRound - history.length + 1 > 0 ? currentRound - history.length + 1 : 1}</span>
        <span>R{currentRound}</span>
      </div>
    </div>
  )
}
