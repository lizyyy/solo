import { Play, Pause, RotateCcw, Square } from 'lucide-react'
import type { GameStatus } from '@/types'

interface Props {
  status: GameStatus
  currentRound: number
  elapsed: string
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onRestart: () => void
  onEnd: () => void
}

export default function GameControls({
  status,
  currentRound,
  elapsed,
  onStart,
  onPause,
  onResume,
  onRestart,
  onEnd,
}: Props) {
  return (
    <div className="bg-[#12163a]/80 rounded-xl border border-purple-900/40 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-400">
          回合 <span className="text-2xl font-bold text-cyan-400 ml-1" style={{ fontFamily: 'Orbitron, monospace' }}>{currentRound}</span>
        </div>
        <div className="text-sm text-gray-400">
          用时 <span className="text-lg font-mono text-purple-300 ml-1">{elapsed}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {status === 'idle' && (
          <button
            onClick={onStart}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-500/80 text-white font-medium transition-all duration-200 shadow-[0_0_16px_rgba(16,185,129,0.3)] hover:shadow-[0_0_24px_rgba(16,185,129,0.5)]"
          >
            <Play size={16} /> 开始
          </button>
        )}
        {status === 'playing' && (
          <>
            <button
              onClick={onPause}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-amber-600/80 hover:bg-amber-500/80 text-white font-medium transition-all duration-200 shadow-[0_0_12px_rgba(217,119,6,0.3)]"
            >
              <Pause size={16} /> 暂停
            </button>
            <button
              onClick={onEnd}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-red-600/80 hover:bg-red-500/80 text-white font-medium transition-all duration-200 shadow-[0_0_12px_rgba(220,38,38,0.3)]"
            >
              <Square size={14} /> 结束
            </button>
          </>
        )}
        {status === 'paused' && (
          <>
            <button
              onClick={onResume}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-500/80 text-white font-medium transition-all duration-200 shadow-[0_0_16px_rgba(16,185,129,0.3)] hover:shadow-[0_0_24px_rgba(16,185,129,0.5)]"
            >
              <Play size={16} /> 继续
            </button>
            <button
              onClick={onEnd}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-red-600/80 hover:bg-red-500/80 text-white font-medium transition-all duration-200 shadow-[0_0_12px_rgba(220,38,38,0.3)]"
            >
              <Square size={14} /> 结束
            </button>
            <button
              onClick={onRestart}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-gray-600/60 hover:bg-gray-500/60 text-gray-200 font-medium transition-all duration-200"
            >
              <RotateCcw size={14} /> 重开
            </button>
          </>
        )}
        {status === 'ended' && (
          <button
            onClick={onRestart}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-purple-600/80 hover:bg-purple-500/80 text-white font-medium transition-all duration-200 shadow-[0_0_16px_rgba(139,92,246,0.3)] hover:shadow-[0_0_24px_rgba(139,92,246,0.5)]"
          >
            <RotateCcw size={16} /> 重开
          </button>
        )}
      </div>
    </div>
  )
}
