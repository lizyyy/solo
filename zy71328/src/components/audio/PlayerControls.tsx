import { useState } from 'react'
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Repeat,
  Volume2,
  VolumeX,
  Eye,
  EyeOff,
} from 'lucide-react'
import { useAudioStore } from '@/store/useAudioStore'
import { cn } from '@/lib/utils'

interface PlayerControlsProps {
  audioId: string
  className?: string
  onPlay?: () => void
  onPause?: () => void
  onSeek?: (time: number) => void
}

export default function PlayerControls({
  audioId,
  className,
  onPlay,
  onPause,
  onSeek,
}: PlayerControlsProps) {
  const audioFile = useAudioStore((state) =>
    state.audioFiles.find((f) => f.id === audioId)
  )
  const currentTime = useAudioStore((state) => state.currentTime)
  const isPlaying = useAudioStore((state) => state.isPlaying)
  const setPlaying = useAudioStore((state) => state.setPlaying)
  const setCurrentTime = useAudioStore((state) => state.setCurrentTime)

  const [isLooping, setIsLooping] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [volume, setVolume] = useState(80)
  const [isMuted, setIsMuted] = useState(false)

  const duration = audioFile?.duration || 0

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handlePlayPause = () => {
    if (isPlaying) {
      onPause?.()
    } else {
      onPlay?.()
    }
    setPlaying(!isPlaying)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value)
    setCurrentTime(time)
    onSeek?.(time)
  }

  const handleSkipBack = () => {
    const newTime = Math.max(0, currentTime - 5)
    setCurrentTime(newTime)
    onSeek?.(newTime)
  }

  const handleSkipForward = () => {
    const newTime = Math.min(duration, currentTime + 5)
    setCurrentTime(newTime)
    onSeek?.(newTime)
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div
      className={cn(
        'bg-bg-secondary rounded-xl border border-border-default overflow-hidden',
        className
      )}
    >
      <div className="px-4 py-3 border-b border-border-default">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button
              onClick={handleSkipBack}
              className="p-2 rounded-lg hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-all"
              title="后退5秒"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              onClick={handlePlayPause}
              className={cn(
                'p-3 rounded-full transition-all',
                'bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/50',
                'hover:bg-accent-cyan/30 hover:shadow-neon hover:border-accent-cyan'
              )}
              title={isPlaying ? '暂停' : '播放'}
            >
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
            </button>

            <button
              onClick={handleSkipForward}
              className="p-2 rounded-lg hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-all"
              title="前进5秒"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 flex items-center gap-3">
            <span className="text-xs font-mono text-text-muted w-12 text-right">
              {formatTime(currentTime)}
            </span>

            <div className="flex-1 relative">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 w-full rounded-full bg-bg-tertiary overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-accent-cyan to-accent-purple shadow-neon-sm transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <input
                type="range"
                min="0"
                max={duration}
                step="0.1"
                value={currentTime}
                onChange={handleSeek}
                className="absolute inset-0 w-full h-1.5 opacity-0 cursor-pointer"
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-accent-cyan border-2 border-white shadow-neon pointer-events-none transition-all"
                style={{ left: `calc(${progress}% - 8px)` }}
              />
            </div>

            <span className="text-xs font-mono text-text-muted w-12">
              {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLooping(!isLooping)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm',
              isLooping
                ? 'bg-accent-purple/20 text-accent-purple border border-accent-purple/50'
                : 'bg-bg-tertiary text-text-secondary hover:text-text-primary border border-transparent'
            )}
          >
            <Repeat className="w-4 h-4" />
            <span>循环播放</span>
          </button>

          <button
            onClick={() => setIsProcessing(!isProcessing)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm',
              isProcessing
                ? 'bg-accent-green/20 text-accent-green border border-accent-green/50'
                : 'bg-bg-tertiary text-text-secondary hover:text-text-primary border border-transparent'
            )}
          >
            {isProcessing ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            <span>{isProcessing ? '处理后' : '处理前'}</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-lg hover:bg-bg-tertiary text-text-secondary hover:text-text-primary transition-all"
            title={isMuted ? '取消静音' : '静音'}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          <div className="w-32 relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 w-full rounded-full bg-bg-tertiary overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-accent-cyan to-accent-purple shadow-neon-sm"
                style={{ width: `${isMuted ? 0 : volume}%` }}
              />
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(Number(e.target.value))
                if (isMuted) setIsMuted(false)
              }}
              className="absolute inset-0 w-full h-1.5 opacity-0 cursor-pointer"
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-accent-cyan border-2 border-white shadow-neon pointer-events-none"
              style={{ left: `calc(${isMuted ? 0 : volume}% - 7px)` }}
            />
          </div>

          <span className="text-xs font-mono text-text-muted w-8 text-right">
            {isMuted ? 0 : volume}%
          </span>
        </div>
      </div>
    </div>
  )
}
