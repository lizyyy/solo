import { useState } from 'react'
import {
  ArrowLeft,
  Edit,
  Download,
  History,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  Zap,
  Volume2,
} from 'lucide-react'
import { useAudioStore } from '@/store/useAudioStore'
import Waveform from '@/components/audio/Waveform'
import TrackList from '@/components/audio/TrackList'
import PlayerControls from '@/components/audio/PlayerControls'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { mockData } from '@/mock/sampleData'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: string
  unit: string
  status?: 'good' | 'warning' | 'error'
}

function MetricCard({ icon, label, value, unit, status = 'good' }: MetricCardProps) {
  const statusColors = {
    good: 'text-accent-green',
    warning: 'text-accent-yellow',
    error: 'text-accent-red',
  }

  return (
    <Card className="flex items-center gap-4">
      <div
        className={cn(
          'p-3 rounded-xl',
          status === 'good' && 'bg-accent-green/10',
          status === 'warning' && 'bg-accent-yellow/10',
          status === 'error' && 'bg-accent-red/10'
        )}
      >
        <div className={statusColors[status]}>{icon}</div>
      </div>
      <div className="flex-1">
        <p className="text-xs text-text-muted mb-1">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className={cn('text-2xl font-bold font-mono', statusColors[status])}>
            {value}
          </span>
          <span className="text-sm text-text-muted">{unit}</span>
        </div>
      </div>
    </Card>
  )
}

export default function Detail() {
  const currentAudioId = useAudioStore((state) => state.currentAudioId)
  const audioFiles = useAudioStore((state) => state.audioFiles)
  const setCurrentAudio = useAudioStore((state) => state.setCurrentAudio)

  const displayFiles = audioFiles.length > 0 ? audioFiles : mockData.audioFiles
  const audioId = currentAudioId || displayFiles[0]?.id
  const audioFile = displayFiles.find((f) => f.id === audioId)

  const loudnessData = audioId ? mockData.loudnessData[audioId] : null
  const peakMarks = audioId
    ? mockData.peakMarks.filter((p) => p.audioId === audioId)
    : []

  const [expandedPeakId, setExpandedPeakId] = useState<string | null>(null)

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 100)
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
  }

  const getLoudnessStatus = () => {
    if (!loudnessData) return 'good'
    const target = -16
    const diff = Math.abs(loudnessData.integratedLufs - target)
    if (diff <= 1) return 'good'
    if (diff <= 2) return 'warning'
    return 'error'
  }

  const getPeakStatus = () => {
    if (!loudnessData) return 'good'
    if (loudnessData.truePeak <= -1) return 'good'
    if (loudnessData.truePeak <= 0) return 'warning'
    return 'error'
  }

  const handleBack = () => {
    setCurrentAudio(null)
  }

  if (!audioFile) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-text-muted">请先选择一个音频文件</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full gap-4 overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={handleBack}
          >
            返回列表
          </Button>
          <div>
            <h1 className="text-xl font-bold text-text-primary">{audioFile.name}</h1>
            <p className="text-sm text-text-muted">
              {audioFile.format.toUpperCase()} · {audioFile.sampleRate / 1000}kHz ·{' '}
              {formatTime(audioFile.duration)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<History className="w-4 h-4" />}
            onClick={() => console.log('View history')}
          >
            历史记录
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Edit className="w-4 h-4" />}
            onClick={() => console.log('Edit params')}
          >
            编辑参数
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={() => console.log('Export')}
          >
            导出
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={<Volume2 className="w-6 h-6" />}
          label="当前响度"
          value={loudnessData?.integratedLufs.toFixed(1) || '--'}
          unit="LUFS"
          status={getLoudnessStatus()}
        />
        <MetricCard
          icon={<Zap className="w-6 h-6" />}
          label="峰值"
          value={loudnessData?.truePeak.toFixed(2) || '--'}
          unit="dBTP"
          status={getPeakStatus()}
        />
        <MetricCard
          icon={<Activity className="w-6 h-6" />}
          label="动态范围"
          value={loudnessData?.rangeLufs.toFixed(1) || '--'}
          unit="LU"
        />
        <MetricCard
          icon={<Clock className="w-6 h-6" />}
          label="时长"
          value={formatTime(audioFile.duration)}
          unit=""
        />
      </div>

      {audioId && <Waveform audioId={audioId} height={280} />}

      {audioId && <PlayerControls audioId={audioId} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-accent-orange" />
                爆音标记
                <span className="text-xs text-text-muted">({peakMarks.length}个)</span>
              </h3>
              <div className="flex items-center gap-2 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-accent-orange" />
                  待修复 {peakMarks.filter((p) => !p.fixed).length}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-accent-green" />
                  已修复 {peakMarks.filter((p) => p.fixed).length}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-auto space-y-2">
              {peakMarks.map((peak) => (
                <div
                  key={peak.id}
                  className={cn(
                    'p-3 rounded-lg border transition-all cursor-pointer',
                    expandedPeakId === peak.id
                      ? 'bg-bg-tertiary border-accent-cyan'
                      : 'bg-bg-tertiary/50 border-border-default hover:border-border-default/80'
                  )}
                  onClick={() =>
                    setExpandedPeakId(expandedPeakId === peak.id ? null : peak.id)
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'p-1.5 rounded-md',
                          peak.fixed ? 'bg-accent-green/10' : 'bg-accent-orange/10'
                        )}
                      >
                        {peak.fixed ? (
                          <CheckCircle className="w-4 h-4 text-accent-green" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-accent-orange" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">
                          {formatTime(peak.time)}
                        </p>
                        <p className="text-xs text-text-muted">
                          峰值: {peak.value.toFixed(2)} dBTP · 类型:{' '}
                          {peak.type === 'clip' ? '削波' : '过冲'}
                        </p>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full',
                        peak.fixed
                          ? 'bg-accent-green/10 text-accent-green'
                          : 'bg-accent-orange/10 text-accent-orange'
                      )}
                    >
                      {peak.fixed ? '已修复' : '待修复'}
                    </span>
                  </div>

                  {expandedPeakId === peak.id && (
                    <div className="mt-3 pt-3 border-t border-border-default flex gap-2">
                      <Button size="sm" variant="primary">
                        自动修复
                      </Button>
                      <Button size="sm" variant="secondary">
                        手动调整
                      </Button>
                      <Button size="sm" variant="ghost">
                        忽略
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              {peakMarks.length === 0 && (
                <div className="text-center py-8 text-text-muted">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">未检测到爆音问题</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {audioId && <TrackList audioId={audioId} />}

          <Card>
            <h3 className="text-sm font-medium text-text-primary mb-3">保护区域</h3>
            <div className="space-y-2">
              {mockData.protectedRegions
                .filter((r) => r.audioId === audioId)
                .map((region) => (
                  <div
                    key={region.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-bg-tertiary/50"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          'w-2 h-2 rounded-full',
                          region.type === 'intro' && 'bg-accent-cyan',
                          region.type === 'outro' && 'bg-accent-purple',
                          region.type === 'music' && 'bg-accent-green',
                          region.type === 'custom' && 'bg-accent-yellow'
                        )}
                      />
                      <span className="text-sm text-text-primary">
                        {region.type === 'intro' && '片头'}
                        {region.type === 'outro' && '片尾'}
                        {region.type === 'music' && '音乐'}
                        {region.type === 'custom' && '自定义'}
                      </span>
                    </div>
                    <span className="text-xs text-text-muted font-mono">
                      {formatTime(region.startTime)} - {formatTime(region.endTime)}
                    </span>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
