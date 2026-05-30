import { useGameStore } from '../store/gameStore'
import { Anchor, DollarSign, Clock } from 'lucide-react'

export function RoundInfo() {
  const { currentRound, totalRounds, balance, phase } = useGameStore()
  const isPlaying = phase === 'playing'

  return (
    <div className="bg-slate-900 border-2 border-slate-700 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Anchor size={24} className="text-amber-400" />
            <div>
              <div className="text-xs text-slate-400">回合</div>
              <div className="text-2xl font-bold text-white font-serif">
                {currentRound} / {totalRounds}
              </div>
            </div>
          </div>
          <div className="h-10 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <DollarSign size={20} className="text-green-400" />
            <div>
              <div className="text-xs text-slate-400">现金余额</div>
              <div className="text-xl font-bold text-green-400 font-serif">
                ¥{balance.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Clock size={20} className={isPlaying ? 'text-amber-400' : 'text-slate-500'} />
          <span className={`text-sm ${isPlaying ? 'text-amber-400' : 'text-slate-500'}`}>
            {isPlaying ? '操作中' : phase === 'setup' ? '准备开始' : phase === 'round_end' ? '回合结束' : '游戏结束'}
          </span>
        </div>
      </div>
    </div>
  )
}
