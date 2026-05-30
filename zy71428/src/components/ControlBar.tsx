import type { GameStatus } from '../types'

interface ControlBarProps {
  status: GameStatus
  clueDeckSize: number
  onStart: () => void
  onPause: () => void
  onResume: () => void
  onEnd: () => void
  onReset: () => void
  onDrawClue: () => void
}

export default function ControlBar({
  status,
  clueDeckSize,
  onStart,
  onPause,
  onResume,
  onEnd,
  onReset,
  onDrawClue,
}: ControlBarProps) {
  return (
    <div className="sticky top-0 z-50 backdrop-blur-md bg-purple-950/80 border-b border-card-border">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🕵️</span>
          <h1 className="font-display text-xl font-bold text-gold tracking-wide">
            贝叶斯侦探牌
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {status === 'idle' && (
            <button
              onClick={onStart}
              className="px-5 py-2 bg-gold text-purple-950 font-bold rounded-lg hover:bg-gold-light transition-all duration-200 active:scale-95"
            >
              🎬 开始游戏
            </button>
          )}

          {status === 'playing' && (
            <>
              <button
                onClick={onDrawClue}
                disabled={clueDeckSize === 0}
                className="px-4 py-2 bg-purple-700 text-white font-semibold rounded-lg hover:bg-purple-600 transition-all duration-200 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                🃏 翻牌 ({clueDeckSize})
              </button>
              <button
                onClick={onPause}
                className="px-4 py-2 bg-purple-800 text-purple-200 font-semibold rounded-lg hover:bg-purple-700 transition-all duration-200 active:scale-95"
              >
                ⏸ 暂停
              </button>
              <button
                onClick={onEnd}
                className="px-4 py-2 bg-suspect-high/80 text-white font-semibold rounded-lg hover:bg-suspect-high transition-all duration-200 active:scale-95"
              >
                🔍 结算
              </button>
            </>
          )}

          {status === 'paused' && (
            <>
              <button
                onClick={onResume}
                className="px-4 py-2 bg-green-700 text-white font-semibold rounded-lg hover:bg-green-600 transition-all duration-200 active:scale-95"
              >
                ▶ 继续
              </button>
              <button
                onClick={onEnd}
                className="px-4 py-2 bg-suspect-high/80 text-white font-semibold rounded-lg hover:bg-suspect-high transition-all duration-200 active:scale-95"
              >
                🔍 结算
              </button>
            </>
          )}

          {status === 'ended' && (
            <button
              onClick={onReset}
              className="px-5 py-2 bg-gold text-purple-950 font-bold rounded-lg hover:bg-gold-light transition-all duration-200 active:scale-95"
            >
              🔄 重新开始
            </button>
          )}

          {status !== 'idle' && status !== 'ended' && (
            <button
              onClick={onReset}
              className="px-3 py-2 text-purple-400 hover:text-purple-200 transition-colors text-sm"
            >
              重开
            </button>
          )}
        </div>

        {status !== 'idle' && (
          <div className="flex items-center gap-2 text-sm text-purple-300">
            <span className={`w-2 h-2 rounded-full ${
              status === 'playing' ? 'bg-green-400 animate-pulse' :
              status === 'paused' ? 'bg-yellow-400' :
              status === 'ended' ? 'bg-red-400' : 'bg-gray-400'
            }`} />
            {status === 'playing' ? '游戏中' : status === 'paused' ? '已暂停' : status === 'ended' ? '已结算' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
