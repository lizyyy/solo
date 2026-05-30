import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { Send, X, BookOpen, FileBarChart, RotateCcw } from 'lucide-react'

export function ActionBar() {
  const navigate = useNavigate()
  const {
    phase, confirmShipment, endRound, resetGame,
    orders, cabinSlots, containers,
  } = useGameStore()

  const hasLoadedOrders = orders.some(o => o.status === 'loaded')
  const hasLockedCabin = cabinSlots.some(s => s.locked)
  const canShip = phase === 'playing' && hasLoadedOrders && hasLockedCabin
  const canEndRound = phase === 'round_end'

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={confirmShipment}
            disabled={!canShip}
            className={`
              flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all duration-200
              ${canShip
                ? 'bg-amber-500 hover:bg-amber-600 text-slate-900 hover:shadow-lg'
                : 'bg-slate-600 text-slate-400 cursor-not-allowed'
              }
            `}
          >
            <Send size={18} />
            确认装船
          </button>
          {canEndRound && (
            <button
              onClick={endRound}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all duration-200 hover:shadow-lg"
            >
              下一回合
            </button>
          )}
          <button
            onClick={resetGame}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
          >
            <RotateCcw size={16} />
            重开
          </button>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/ledger')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
          >
            <BookOpen size={16} />
            现金账本
          </button>
          <button
            onClick={() => navigate('/report')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors"
          >
            <FileBarChart size={16} />
            经营报告
          </button>
        </div>
      </div>
      {phase === 'playing' && !canShip && (
        <div className="mt-3 text-xs text-amber-400">
          {!hasLoadedOrders && '💡 提示：拖拽订单卡到货柜区进行装载'}
          {hasLoadedOrders && !hasLockedCabin && '💡 提示：请点击选择并锁定舱位'}
        </div>
      )}
    </div>
  )
}
