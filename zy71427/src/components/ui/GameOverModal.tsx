import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { Trophy, ArrowRight, RotateCcw, History } from 'lucide-react'

export default function GameOverModal() {
  const navigate = useNavigate()
  const gameResult = useGameStore(s => s.gameResult)
  const resetGame = useGameStore(s => s.resetGame)

  if (!gameResult) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center animate-[fadeIn_0.3s_ease-out]">
      <div className="bg-[#1A1A2E] rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl animate-[scaleIn_0.3s_ease-out]">
        <div className="text-center mb-6">
          <Trophy className="w-12 h-12 text-[#F0A500] mx-auto mb-3" />
          <h2 className="text-2xl font-bold text-white">游戏结束</h2>
        </div>

        <div className="text-center mb-6">
          <span className="text-6xl font-bold text-[#F0A500]">{gameResult.score}</span>
          <p className="text-white/50 text-sm mt-1">总分</p>
        </div>

        <div className="flex flex-col gap-2 mb-8">
          <div className="flex items-center justify-between bg-red-500/10 rounded-lg px-4 py-2">
            <span className="text-sm text-white/70">路线交叉扣分</span>
            <span className="text-sm font-bold text-red-400">-{gameResult.routeCrossPenalty}</span>
          </div>
          <div className="flex items-center justify-between bg-amber-500/10 rounded-lg px-4 py-2">
            <span className="text-sm text-white/70">出餐超时扣分</span>
            <span className="text-sm font-bold text-amber-400">-{gameResult.timeoutPenalty}</span>
          </div>
          <div className="flex items-center justify-between bg-purple-500/10 rounded-lg px-4 py-2">
            <span className="text-sm text-white/70">清洁漏做扣分</span>
            <span className="text-sm font-bold text-purple-400">-{gameResult.missedCleanPenalty}</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/records')}
            className="flex items-center justify-center gap-2 w-full py-3 bg-[#4A90D9] hover:bg-[#4A90D9]/80 text-white rounded-lg font-bold transition-colors"
          >
            <History className="w-5 h-5" />
            查看记录
          </button>
          <button
            onClick={() => navigate('/replay')}
            className="flex items-center justify-center gap-2 w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold transition-colors"
          >
            <ArrowRight className="w-5 h-5" />
            复盘回放
          </button>
          <button
            onClick={resetGame}
            className="flex items-center justify-center gap-2 w-full py-3 bg-[#F0A500] hover:bg-[#F0A500]/80 text-black rounded-lg font-bold transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            重新开始
          </button>
        </div>
      </div>
    </div>
  )
}
