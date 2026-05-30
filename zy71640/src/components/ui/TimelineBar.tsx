import { useRef, useEffect, useCallback } from 'react'
import { Play, Pause } from 'lucide-react'
import { useExhibitionStore } from '@/store/useExhibitionStore'

const SPEED_OPTIONS = [0.5, 1, 2] as const

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function getMaxDuration(paths: { points: { time: number }[] }[]): number {
  let max = 0
  for (const path of paths) {
    if (path.points.length > 0) {
      const duration = path.points[path.points.length - 1].time
      if (duration > max) max = duration
    }
  }
  return max
}

export default function TimelineBar() {
  const playbackTime = useExhibitionStore((s) => s.playbackTime)
  const isPlaying = useExhibitionStore((s) => s.isPlaying)
  const playbackSpeed = useExhibitionStore((s) => s.playbackSpeed)
  const paths = useExhibitionStore((s) => s.paths)
  const setPlaybackTime = useExhibitionStore((s) => s.setPlaybackTime)
  const togglePlayback = useExhibitionStore((s) => s.togglePlayback)
  const setPlaybackSpeed = useExhibitionStore((s) => s.setPlaybackSpeed)

  const rafRef = useRef<number>(0)
  const prevTimeRef = useRef<number>(0)

  const maxDuration = getMaxDuration(paths)

  const tick = useCallback((timestamp: number) => {
    if (prevTimeRef.current === 0) {
      prevTimeRef.current = timestamp
    }
    const delta = (timestamp - prevTimeRef.current) / 1000
    prevTimeRef.current = timestamp

    const state = useExhibitionStore.getState()
    const nextTime = state.playbackTime + delta * state.playbackSpeed
    if (nextTime >= maxDuration && maxDuration > 0) {
      state.setPlaybackTime(maxDuration)
      state.togglePlayback()
    } else {
      state.setPlaybackTime(nextTime)
    }

    if (useExhibitionStore.getState().isPlaying) {
      rafRef.current = requestAnimationFrame(tick)
    }
  }, [maxDuration])

  useEffect(() => {
    if (isPlaying) {
      prevTimeRef.current = 0
      rafRef.current = requestAnimationFrame(tick)
    } else {
      cancelAnimationFrame(rafRef.current)
    }
    return () => cancelAnimationFrame(rafRef.current)
  }, [isPlaying, tick])

  const progress = maxDuration > 0 ? (playbackTime / maxDuration) * 100 : 0

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setPlaybackTime(ratio * maxDuration)
  }

  return (
    <div className="flex h-12 items-center gap-3 border-t border-zinc-700/50 bg-[#1a1a2e] px-4">
      <button
        onClick={togglePlayback}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-white transition-colors hover:bg-blue-600"
      >
        {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
      </button>

      <span className="w-10 text-right text-xs tabular-nums text-zinc-200">
        {formatTime(playbackTime)}
      </span>

      <div
        className="relative h-1.5 flex-1 cursor-pointer rounded-full bg-zinc-700"
        onClick={handleProgressClick}
      >
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-blue-500 transition-[width] duration-75"
          style={{ width: `${progress}%` }}
        />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-blue-400 shadow-md transition-[left] duration-75"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
      </div>

      <span className="w-10 text-xs tabular-nums text-zinc-400">
        {formatTime(maxDuration)}
      </span>

      <div className="flex items-center gap-0.5 rounded bg-[#16213e] p-0.5">
        {SPEED_OPTIONS.map((speed) => (
          <button
            key={speed}
            onClick={() => setPlaybackSpeed(speed)}
            className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
              playbackSpeed === speed
                ? 'bg-blue-500/20 text-blue-400'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>
    </div>
  )
}
