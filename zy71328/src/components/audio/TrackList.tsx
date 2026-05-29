import { useState, useEffect } from 'react'
import { Volume2, VolumeX, Headphones, GripVertical, User } from 'lucide-react'
import type { Track } from '@/types'
import { mockData } from '@/mock/sampleData'
import { cn } from '@/lib/utils'

interface TrackListProps {
  audioId: string
  className?: string
}

interface TrackItemProps {
  track: Track
  index: number
  isDragging: boolean
  onDragStart: (index: number) => void
  onDragEnd: () => void
  onDragOver: (index: number) => void
  onMuteToggle: (id: string) => void
  onSoloToggle: (id: string) => void
  onGainChange: (id: string, gain: number) => void
  level: number
}

function TrackItem({
  track,
  index,
  isDragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onMuteToggle,
  onSoloToggle,
  onGainChange,
  level,
}: TrackItemProps) {
  const [levelHistory, setLevelHistory] = useState<number[]>(Array(20).fill(0))

  useEffect(() => {
    const interval = setInterval(() => {
      setLevelHistory((prev) => {
        const newHistory = [...prev.slice(1), level]
        return newHistory
      })
    }, 50)
    return () => clearInterval(interval)
  }, [level])

  return (
    <div
      draggable
      onDragStart={() => onDragStart(index)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault()
        onDragOver(index)
      }}
      className={cn(
        'flex items-center gap-3 p-3 bg-bg-tertiary rounded-lg border border-border-default transition-all',
        'hover:border-accent-cyan/50 hover:bg-bg-tertiary/80',
        isDragging && 'opacity-50 border-accent-purple',
        track.muted && 'opacity-60'
      )}
    >
      <div className="cursor-grab active:cursor-grabbing text-text-muted hover:text-text-secondary transition-colors">
        <GripVertical className="w-4 h-4" />
      </div>

      <div
        className="w-1 h-10 rounded-full"
        style={{ backgroundColor: track.color }}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-text-primary truncate">{track.name}</span>
          <div className="flex items-center gap-1 text-xs text-text-muted">
            <User className="w-3 h-3" />
            <span>{track.guestName}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 h-4 bg-bg-primary rounded overflow-hidden flex items-end gap-px px-0.5">
            {levelHistory.map((val, i) => (
              <div
                key={i}
                className={cn(
                  'flex-1 rounded-t transition-all duration-75',
                  val > 0.9
                    ? 'bg-accent-red'
                    : val > 0.7
                    ? 'bg-accent-orange'
                    : 'bg-accent-green'
                )}
                style={{
                  height: `${Math.max(2, val * 100)}%`,
                  opacity: 0.5 + (i / levelHistory.length) * 0.5,
                }}
              />
            ))}
          </div>

          <span className="text-xs font-mono text-text-muted w-10 text-right">
            {Math.round(level * 100)}%
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => onMuteToggle(track.id)}
          className={cn(
            'p-2 rounded-md transition-all',
            track.muted
              ? 'bg-accent-red/20 text-accent-red'
              : 'hover:bg-bg-primary text-text-secondary hover:text-text-primary'
          )}
          title={track.muted ? '取消静音' : '静音'}
        >
          {track.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
        </button>

        <button
          onClick={() => onSoloToggle(track.id)}
          className={cn(
            'p-2 rounded-md transition-all',
            track.solo
              ? 'bg-accent-yellow/20 text-accent-yellow'
              : 'hover:bg-bg-primary text-text-secondary hover:text-text-primary'
          )}
          title={track.solo ? '取消独奏' : '独奏'}
        >
          <Headphones className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-2 w-32">
        <input
          type="range"
          min="-20"
          max="10"
          step="0.5"
          value={track.gain}
          onChange={(e) => onGainChange(track.id, Number(e.target.value))}
          className="flex-1 h-1.5 bg-bg-primary rounded-full appearance-none cursor-pointer"
          style={{
            background: `linear-gradient(to right, ${track.color} ${((track.gain + 20) / 30) * 100}%, rgb(30, 41, 59) ${((track.gain + 20) / 30) * 100}%)`,
          }}
        />
        <span className="text-xs font-mono text-text-muted w-12 text-right">
          {track.gain > 0 ? '+' : ''}{track.gain.toFixed(1)}dB
        </span>
      </div>
    </div>
  )
}

export default function TrackList({ audioId, className }: TrackListProps) {
  const [tracks, setTracks] = useState<Track[]>(
    mockData.tracks.filter((t) => t.audioId === audioId)
  )
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [trackLevels, setTrackLevels] = useState<Record<string, number>>({})

  useEffect(() => {
    const interval = setInterval(() => {
      setTrackLevels((prev) => {
        const next: Record<string, number> = {}
        tracks.forEach((track) => {
          const base = prev[track.id] ?? 0.3
          const change = (Math.random() - 0.5) * 0.3
          next[track.id] = Math.max(0, Math.min(1, base + change))
        })
        return next
      })
    }, 100)
    return () => clearInterval(interval)
  }, [tracks])

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const handleDragOver = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) return

    const newTracks = [...tracks]
    const [draggedItem] = newTracks.splice(draggedIndex, 1)
    newTracks.splice(index, 0, draggedItem)
    setTracks(newTracks)
    setDraggedIndex(index)
  }

  const handleMuteToggle = (id: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, muted: !t.muted } : t))
    )
  }

  const handleSoloToggle = (id: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, solo: !t.solo } : t))
    )
  }

  const handleGainChange = (id: string, gain: number) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, gain } : t))
    )
  }

  if (tracks.length === 0) {
    return (
      <div className={cn('bg-bg-secondary rounded-xl border border-border-default p-6', className)}>
        <div className="text-center text-text-muted">
          <Headphones className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">暂无轨道数据</p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('bg-bg-secondary rounded-xl border border-border-default overflow-hidden', className)}>
      <div className="px-4 py-3 border-b border-border-default">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-text-primary">嘉宾轨道</h3>
          <span className="text-xs text-text-muted">{tracks.length} 个轨道</span>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {tracks.map((track, index) => (
          <TrackItem
            key={track.id}
            track={track}
            index={index}
            isDragging={draggedIndex === index}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragOver={handleDragOver}
            onMuteToggle={handleMuteToggle}
            onSoloToggle={handleSoloToggle}
            onGainChange={handleGainChange}
            level={track.muted ? 0 : trackLevels[track.id] ?? 0}
          />
        ))}
      </div>

      <div className="px-4 py-2 border-t border-border-default bg-bg-tertiary/50">
        <p className="text-xs text-text-muted">拖拽轨道可调整顺序</p>
      </div>
    </div>
  )
}
