import { useState } from 'react'
import {
  ArrowLeft,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Upload,
  Play,
  Settings,
  CheckCircle,
  FileAudio,
  Clock,
  User,
} from 'lucide-react'
import { useHistoryStore } from '@/store/useHistoryStore'
import { useConfigStore } from '@/store/useConfigStore'
import { useAudioStore } from '@/store/useAudioStore'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { mockData } from '@/mock/sampleData'
import { cn } from '@/lib/utils'
import type { HistoryRecord } from '@/types'

interface TimelineNodeProps {
  record: HistoryRecord
  isExpanded: boolean
  onToggle: () => void
  onRollback: () => void
}

const actionIcons: Record<string, React.ReactNode> = {
  '导入文件': <Upload className="w-4 h-4" />,
  '分析完成': <CheckCircle className="w-4 h-4" />,
  '更新参数': <Settings className="w-4 h-4" />,
  '开始': <Play className="w-4 h-4" />,
  '处理完成': <CheckCircle className="w-4 h-4" />,
  '添加保护区域': <FileAudio className="w-4 h-4" />,
}

const actionColors: Record<string, string> = {
  '导入文件': 'bg-accent-cyan/20 text-accent-cyan border-accent-cyan/50',
  '分析完成': 'bg-accent-green/20 text-accent-green border-accent-green/50',
  '更新参数': 'bg-accent-purple/20 text-accent-purple border-accent-purple/50',
  '开始': 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/50',
  '处理完成': 'bg-accent-green/20 text-accent-green border-accent-green/50',
  '添加保护区域': 'bg-accent-orange/20 text-accent-orange border-accent-orange/50',
}

const getActionKey = (description: string): string => {
  if (description.includes('导入文件')) return '导入文件'
  if (description.includes('分析完成')) return '分析完成'
  if (description.includes('更新参数')) return '更新参数'
  if (description.includes('开始')) return '开始'
  if (description.includes('处理完成')) return '处理完成'
  if (description.includes('添加保护区域')) return '添加保护区域'
  return ''
}

function TimelineNode({ record, isExpanded, onToggle, onRollback }: TimelineNodeProps) {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  const formatParamsSummary = (params: Record<string, any>) => {
    const entries = Object.entries(params).slice(0, 3)
    return entries
      .map(([key, value]) => {
        const displayValue = typeof value === 'number' ? value.toFixed(1) : String(value)
        return `${key}: ${displayValue}`
      })
      .join(' · ')
  }

  const paramDiff = record.previousConfig
    ? Object.entries(record.config).filter(
        ([key, value]) => record.previousConfig?.[key] !== value
      )
    : []

  const actionKey = getActionKey(record.description)

  return (
    <div className="relative pl-8 pb-6">
      <div className="absolute left-3 top-0 bottom-0 w-0.5 bg-border-default" />

      <div
        className={cn(
          'absolute left-0 top-0 w-7 h-7 rounded-full border-2 flex items-center justify-center z-10',
          actionColors[actionKey] || 'bg-bg-tertiary text-text-muted border-border-default'
        )}
      >
        {actionIcons[actionKey] || <Clock className="w-3.5 h-3.5" />}
      </div>

      <div
        onClick={onToggle}
        className="bg-bg-secondary border border-border-default rounded-xl p-4 cursor-pointer transition-all hover:border-accent-cyan/50 hover:shadow-lg"
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="text-sm font-medium text-text-primary">{record.description}</h4>
              <span className="text-xs text-text-muted font-mono">
                {formatTime(record.timestamp)}
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-text-muted">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                系统
              </span>
              <span className="text-text-muted/50">|</span>
              <span>{formatParamsSummary(record.config)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {record.previousConfig && paramDiff.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
                onClick={(e) => {
                  e.stopPropagation()
                  onRollback()
                }}
              >
                回滚
              </Button>
            )}
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-text-muted" />
            ) : (
              <ChevronDown className="w-4 h-4 text-text-muted" />
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-border-default">
            {record.previousConfig && paramDiff.length > 0 && (
              <div className="mb-4">
                <h5 className="text-xs font-medium text-text-secondary mb-2">参数变更</h5>
                <div className="space-y-2">
                  {paramDiff.map(([key, value]) => (
                    <div
                      key={key}
                      className="flex items-center gap-4 p-2 rounded-lg bg-bg-tertiary/50"
                    >
                      <span className="text-sm text-text-secondary w-32">{key}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-accent-red line-through">
                          {String(record.previousConfig?.[key])}
                        </span>
                        <span className="text-text-muted">→</span>
                        <span className="text-sm font-mono text-accent-green">
                          {String(value)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h5 className="text-xs font-medium text-text-secondary mb-2">完整参数</h5>
              <pre className="p-3 rounded-lg bg-bg-tertiary text-xs font-mono text-text-muted overflow-auto max-h-48">
                {JSON.stringify(record.config, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function History() {
  const historyRecords = useHistoryStore((state) => state.historyRecords)
  const rollbackToVersion = useHistoryStore((state) => state.rollbackToVersion)
  const updateConfig = useConfigStore((state) => state.updateConfig)
  const currentAudioId = useAudioStore((state) => state.currentAudioId)
  const audioFiles = useAudioStore((state) => state.audioFiles)

  const [expandedId, setExpandedId] = useState<string | null>(null)

  const displayFiles = audioFiles.length > 0 ? audioFiles : mockData.audioFiles
  const displayRecords =
    historyRecords.length > 0 ? historyRecords : mockData.historyRecords

  const filteredRecords = currentAudioId
    ? displayRecords.filter((r) => r.audioFileId === currentAudioId)
    : displayRecords

  const currentAudio = currentAudioId
    ? displayFiles.find((f) => f.id === currentAudioId)
    : null

  const handleRollback = (recordId: string) => {
    const config = rollbackToVersion(recordId)
    if (config) {
      updateConfig(config)
      console.log('Rolled back to:', recordId)
    }
  }

  return (
    <div className="flex flex-col h-full gap-4 overflow-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ArrowLeft className="w-4 h-4" />}
            onClick={() => console.log('Go back')}
          >
            返回
          </Button>
          <div>
            <h1 className="text-xl font-bold text-text-primary">处理历史</h1>
            <p className="text-sm text-text-muted">
              {currentAudio
                ? `查看 "${currentAudio.name}" 的操作记录`
                : '查看所有音频的操作记录'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-text-muted">
            共 {filteredRecords.length} 条记录
          </span>
        </div>
      </div>

      {currentAudio && (
        <Card className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-accent-purple/10">
            <FileAudio className="w-6 h-6 text-accent-purple" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary">{currentAudio.name}</p>
            <p className="text-xs text-text-muted">
              {currentAudio.format.toUpperCase()} · {currentAudio.sampleRate / 1000}kHz
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => useAudioStore.getState().setCurrentAudio(null)}
          >
            查看全部
          </Button>
        </Card>
      )}

      <div className="flex-1">
        {filteredRecords.length > 0 ? (
          <div className="relative">
            {filteredRecords.map((record) => (
              <TimelineNode
                key={record.id}
                record={record}
                isExpanded={expandedId === record.id}
                onToggle={() =>
                  setExpandedId(expandedId === record.id ? null : record.id)
                }
                onRollback={() => handleRollback(record.id)}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <Clock className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-sm">暂无历史记录</p>
          </div>
        )}
      </div>
    </div>
  )
}
