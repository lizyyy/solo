import { useGameStore } from '@/store/gameStore'
import { GAME_DURATION_MS } from '@/types'
import { Clock } from 'lucide-react'

function getBarColor(percent: number): string {
  if (percent > 0.5) return '#4ADE80'
  if (percent > 0.2) return '#FBBF24'
  return '#EF4444'
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function TimerBar() {
  const gameTime = useGameStore(s => s.gameTime)
  const remaining = Math.max(0, GAME_DURATION_MS - gameTime)
  const percent = remaining / GAME_DURATION_MS
  const barColor = getBarColor(percent)
  const isLow = percent <= 0.2

  return (
    <div className="w-full h-12 bg-[#1A1A2E] flex items-center px-4 gap-3 relative z-10">
      <Clock className="w-5 h-5 text-white/70" />
      <div className="flex-1 h-4 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${isLow ? 'animate-pulse' : ''}`}
          style={{
            width: `${percent * 100}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
      <span
        className={`text-sm font-mono font-bold min-w-[60px] text-right ${isLow ? 'text-red-400 animate-pulse' : 'text-white/80'}`}
      >
        {formatTime(remaining)}
      </span>
    </div>
  )
}
