import { useRef, useState, useCallback, useEffect } from 'react'
import { Play, Pause, SkipBack, SkipForward, RotateCcw } from 'lucide-react'
import useSceneStore from '../../store/useSceneStore'

function Timeline() {
  const { currentTime, totalDuration, isPlaying, playSpeed, setCurrentTime, setIsPlaying, setPlaySpeed, jumpToTime } =
    useSceneStore()
  const trackRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (!trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const percentage = x / rect.width
      const time = percentage * totalDuration
      jumpToTime(time)
    },
    [totalDuration, jumpToTime]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
      const percentage = x / rect.width
      const time = percentage * totalDuration
      setCurrentTime(Math.max(0, Math.min(time, totalDuration)))
    },
    [isDragging, totalDuration, setCurrentTime]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  const progress = (currentTime / totalDuration) * 100
  const formatTime = (t: number) => {
    const minutes = Math.floor(t / 60)
    const seconds = Math.floor(t % 60)
    const ms = Math.floor((t % 1) * 100)
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
  }

  const speeds = [0.5, 1, 2, 4]

  return (
    <div className="h-24 bg-dark-light border-t border-slate-700 px-6 py-3 flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => jumpToTime(0)}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            title="重置"
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={() => jumpToTime(Math.max(0, currentTime - 5))}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            title="后退5秒"
          >
            <SkipBack size={16} />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-3 bg-info hover:bg-blue-600 rounded-full transition-colors"
          >
            {isPlaying ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <button
            onClick={() => jumpToTime(Math.min(totalDuration, currentTime + 5))}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
            title="前进5秒"
          >
            <SkipForward size={16} />
          </button>

          <div className="flex items-center gap-1 ml-4">
            {speeds.map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaySpeed(speed)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  playSpeed === speed ? 'bg-info text-white' : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        <div className="font-mono text-lg text-info">
          {formatTime(currentTime)} / {formatTime(totalDuration)}
        </div>
      </div>

      <div className="flex-1 flex items-center">
        <div
          ref={trackRef}
          className="timeline-track w-full"
          onClick={handleTrackClick}
        >
          <div className="timeline-progress" style={{ width: `${progress}%` }}>
            <div
              className="timeline-thumb"
              onMouseDown={handleMouseDown}
            />
          </div>

          {useSceneStore.getState().conflicts.map((conflict) => (
            <div
              key={conflict.id}
              className={`conflict-marker ${conflict.severity}`}
              style={{ left: `${(conflict.time / totalDuration) * 100}%` }}
              onClick={(e) => {
                e.stopPropagation()
                jumpToTime(conflict.time)
              }}
              title={conflict.description}
            />
          ))}

          {useSceneStore.getState().accidentPoints.map((acc) => (
            <div
              key={acc.id}
              className="absolute top-0 w-1 h-4 bg-danger rounded"
              style={{ left: `${(acc.time / totalDuration) * 100}%` }}
              onClick={(e) => {
                e.stopPropagation()
                jumpToTime(acc.time)
              }}
              title={acc.description}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default Timeline
