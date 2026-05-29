import { useState } from 'react'
import {
  Eye,
  Edit,
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle,
  Loader2,
  Play,
  FileAudio,
} from 'lucide-react'
import type { AudioFile, AudioStatus, LoudnessData } from '@/types'
import { mockData } from '@/mock/sampleData'
import { useAudioStore } from '@/store/useAudioStore'
import { cn } from '@/lib/utils'

interface AudioCardProps {
  audioFile: AudioFile
  selected?: boolean
  onSelect?: (id: string) => void
  onView?: (id: string) => void
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  className?: string
}

const statusConfig: Record<
  AudioStatus,
  { label: string; color: string; bgColor: string; icon: React.ReactNode }
> = {
  pending: {
    label: '待处理',
    color: 'text-text-secondary',
    bgColor: 'bg-bg-tertiary',
    icon: <Clock className="w-3 h-3" />,
  },
  analyzing: {
    label: '分析中',
    color: 'text-accent-yellow',
    bgColor: 'bg-accent-yellow/10',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  ready: {
    label: '已就绪',
    color: 'text-accent-cyan',
    bgColor: 'bg-accent-cyan/10',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  processing: {
    label: '处理中',
    color: 'text-accent-purple',
    bgColor: 'bg-accent-purple/10',
    icon: <Loader2 className="w-3 h-3 animate-spin" />,
  },
  completed: {
    label: '已完成',
    color: 'text-accent-green',
    bgColor: 'bg-accent-green/10',
    icon: <CheckCircle className="w-3 h-3" />,
  },
  error: {
    label: '错误',
    color: 'text-accent-red',
    bgColor: 'bg-accent-red/10',
    icon: <AlertCircle className="w-3 h-3" />,
  },
}

function MiniWaveform({ audioId, className }: { audioId: string; className?: string }) {
  const loudnessData: LoudnessData | undefined = mockData.loudnessData[audioId]
  const data = loudnessData?.momentaryLufs?.slice(0, 100) || []

  return (
    <div className={cn('flex items-end gap-px h-12', className)}>
      {data.map((value, i) => {
        const normalized = Math.max(0, Math.min(1, (value + 60) / 40))
        return (
          <div
            key={i}
            className="flex-1 rounded-t bg-gradient-to-t from-accent-cyan/40 to-accent-cyan transition-all"
            style={{ height: `${Math.max(4, normalized * 100)}%` }}
          />
        )
      })}
    </div>
  )
}

export default function AudioCard({
  audioFile,
  selected = false,
  onSelect,
  onView,
  onEdit,
  onDelete,
  className,
}: AudioCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const setCurrentAudio = useAudioStore((state) => state.setCurrentAudio)

  const loudnessData = mockData.loudnessData[audioFile.id]
  const targetLufs = -16
  const lufsDiff = loudnessData
    ? Math.abs(loudnessData.integratedLufs - targetLufs)
    : 0
  const isLoudnessOk = loudnessData ? lufsDiff <= 1 : false

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const status = statusConfig[audioFile.status]

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCurrentAudio(audioFile.id)
  }

  return (
    <div
      className={cn(
        'bg-bg-secondary border border-border-default rounded-xl overflow-hidden',
        'transition-all duration-200 cursor-pointer group',
        'hover:border-accent-cyan/50 hover:shadow-lg',
        selected && 'border-accent-purple shadow-neon-purple',
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onSelect?.(audioFile.id)}
    >
      <div className="relative">
        <MiniWaveform audioId={audioFile.id} className="px-4 pt-4 pb-2" />

        {isHovered && (
          <div className="absolute inset-0 bg-bg-primary/80 flex items-center justify-center backdrop-blur-sm">
            <button
              onClick={handlePlayClick}
              className="p-4 rounded-full bg-accent-cyan/20 text-accent-cyan border border-accent-cyan/50 hover:bg-accent-cyan/30 hover:shadow-neon transition-all"
            >
              <Play className="w-6 h-6" />
            </button>
          </div>
        )}

        <div className="absolute top-3 right-3">
          <div
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
              status.bgColor,
              status.color
            )}
          >
            {status.icon}
            <span>{status.label}</span>
          </div>
        </div>
      </div>

      <div className="p-4 pt-2">
        <div className="flex items-start gap-3 mb-2">
          <div className="p-2 rounded-lg bg-bg-tertiary text-text-muted">
            <FileAudio className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-text-primary truncate" title={audioFile.name}>
              {audioFile.name}
            </h3>
            <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(audioFile.duration)}
              </span>
              <span className="uppercase">{audioFile.format}</span>
              <span>{audioFile.sampleRate / 1000}kHz</span>
            </div>
          </div>
        </div>

        {loudnessData && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-text-muted">响度:</span>
            <span
              className={cn(
                'text-sm font-mono font-medium',
                isLoudnessOk ? 'text-accent-green' : 'text-accent-red'
              )}
            >
              {loudnessData.integratedLufs.toFixed(1)} LUFS
            </span>
            <span
              className={cn(
                'text-xs px-1.5 py-0.5 rounded',
                isLoudnessOk
                  ? 'bg-accent-green/10 text-accent-green'
                  : 'bg-accent-red/10 text-accent-red'
              )}
            >
              {isLoudnessOk ? '达标' : `差 ${lufsDiff.toFixed(1)}`}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-border-default">
          <span className="text-xs text-text-muted">
            {formatDate(audioFile.updatedAt)}
          </span>

          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation()
                onView?.(audioFile.id)
              }}
              className="p-1.5 rounded-md hover:bg-bg-tertiary text-text-secondary hover:text-accent-cyan transition-colors"
              title="查看详情"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit?.(audioFile.id)
              }}
              className="p-1.5 rounded-md hover:bg-bg-tertiary text-text-secondary hover:text-accent-purple transition-colors"
              title="编辑参数"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete?.(audioFile.id)
              }}
              className="p-1.5 rounded-md hover:bg-bg-tertiary text-text-secondary hover:text-accent-red transition-colors"
              title="删除"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
