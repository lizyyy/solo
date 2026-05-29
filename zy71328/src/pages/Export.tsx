import { useState } from 'react'
import {
  ArrowLeft,
  Download,
  FileAudio,
  FileText,
  Check,
  Settings,
  Volume2,
  Zap,
  Clock,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react'
import { useAudioStore } from '@/store/useAudioStore'
import { useHistoryStore } from '@/store/useHistoryStore'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Toggle from '@/components/forms/Toggle'
import Input from '@/components/forms/Input'
import { mockData } from '@/mock/sampleData'
import { cn } from '@/lib/utils'
import type { AudioFile, ProcessReport } from '@/types'

interface ExportItemProps {
  audio: AudioFile
  report?: ProcessReport
  selected: boolean
  onToggle: () => void
}

function ExportItem({ audio, report, selected, onToggle }: ExportItemProps) {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer',
        selected
          ? 'bg-accent-cyan/5 border-accent-cyan'
          : 'bg-bg-tertiary/50 border-border-default hover:border-border-default/80'
      )}
      onClick={onToggle}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        className="w-4 h-4 rounded border-border-default bg-bg-secondary text-accent-cyan focus:ring-accent-cyan"
      />

      <div className="p-2 rounded-lg bg-bg-secondary">
        <FileAudio className="w-5 h-5 text-accent-purple" />
      </div>

      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-text-primary truncate">{audio.name}</h4>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-text-muted">
            {formatDuration(audio.duration)}
          </span>
          <span className="text-xs text-text-muted">·</span>
          <span className="text-xs text-text-muted uppercase">{audio.format}</span>
          {report && (
            <>
              <span className="text-xs text-text-muted">·</span>
              <span
                className={cn(
                  'text-xs font-mono',
                  Math.abs(report.processedLufs + 16) <= 1
                    ? 'text-accent-green'
                    : 'text-accent-orange'
                )}
              >
                {report.processedLufs.toFixed(1)} LUFS
              </span>
            </>
          )}
        </div>
      </div>

      {report && (
        <div className="flex items-center gap-1 text-xs">
          {report.peakMarksCount > 0 && (
            <span
              className={cn(
                'px-1.5 py-0.5 rounded',
                report.fixedPeaksCount === report.peakMarksCount
                  ? 'bg-accent-green/10 text-accent-green'
                  : 'bg-accent-orange/10 text-accent-orange'
              )}
            >
              {report.fixedPeaksCount}/{report.peakMarksCount} 爆音
            </span>
          )}
        </div>
      )}

      {selected && (
        <div className="p-1 rounded-full bg-accent-cyan text-white">
          <Check className="w-3 h-3" />
        </div>
      )}
    </div>
  )
}

function ReportPreview({ audioId }: { audioId: string }) {
  const report = mockData.reports.find((r) => r.audioFileId === audioId)
  const audio = mockData.audioFiles.find((f) => f.id === audioId)

  if (!report || !audio) {
    return (
      <div className="text-center py-8 text-text-muted">
        <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">暂无处理报告</p>
      </div>
    )
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-3 rounded-lg bg-bg-tertiary/50">
        <div className="p-2 rounded-lg bg-accent-cyan/10">
          <FileText className="w-5 h-5 text-accent-cyan" />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-medium text-text-primary">处理报告</h4>
          <p className="text-xs text-text-muted">{formatDate(report.timestamp)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-bg-tertiary/30">
          <p className="text-xs text-text-muted mb-1">原始响度</p>
          <p className="text-lg font-mono text-accent-orange">
            {report.originalLufs.toFixed(1)} LUFS
          </p>
        </div>
        <div className="p-3 rounded-lg bg-bg-tertiary/30">
          <p className="text-xs text-text-muted mb-1">处理后响度</p>
          <p className="text-lg font-mono text-accent-green">
            {report.processedLufs.toFixed(1)} LUFS
          </p>
        </div>
        <div className="p-3 rounded-lg bg-bg-tertiary/30">
          <p className="text-xs text-text-muted mb-1">原始峰值</p>
          <p className="text-lg font-mono text-accent-orange">
            {report.originalTruePeak.toFixed(2)} dBTP
          </p>
        </div>
        <div className="p-3 rounded-lg bg-bg-tertiary/30">
          <p className="text-xs text-text-muted mb-1">处理后峰值</p>
          <p className="text-lg font-mono text-accent-green">
            {report.processedTruePeak.toFixed(2)} dBTP
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <h5 className="text-xs font-medium text-text-secondary">处理指标</h5>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-accent-orange" />
              检测到爆音
            </span>
            <span className="text-text-primary">{report.peakMarksCount} 处</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-accent-green" />
              已修复爆音
            </span>
            <span className="text-text-primary">{report.fixedPeaksCount} 处</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent-purple" />
              处理耗时
            </span>
            <span className="text-text-primary">{report.duration.toFixed(1)} 秒</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <h5 className="text-xs font-medium text-text-secondary">应用参数</h5>
        <div className="p-3 rounded-lg bg-bg-tertiary/30 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted flex items-center gap-1.5">
              <Volume2 className="w-3 h-3" />
              目标响度
            </span>
            <span className="text-text-primary font-mono">
              {report.config.targetLufs} LUFS
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted flex items-center gap-1.5">
              <Zap className="w-3 h-3" />
              峰值限制
            </span>
            <span className="text-text-primary font-mono">
              {report.config.truePeakLimit} dBTP
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-text-muted flex items-center gap-1.5">
              <Settings className="w-3 h-3" />
              压缩比率
            </span>
            <span className="text-text-primary font-mono">
              {report.config.compressorRatio}:1
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Export() {
  const audioFiles = useAudioStore((state) => state.audioFiles)
  const reports = useHistoryStore((state) => state.reports)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [exportFormat, setExportFormat] = useState<'wav' | 'mp3'>('wav')
  const [includeReport, setIncludeReport] = useState(true)
  const [namingRule, setNamingRule] = useState('{name}_processed')
  const [isExporting, setIsExporting] = useState(false)

  const displayFiles = audioFiles.length > 0 ? audioFiles : mockData.audioFiles
  const displayReports = reports.length > 0 ? reports : mockData.reports

  const completedFiles = displayFiles.filter((f) => f.status === 'completed')
  const firstSelectedId = Array.from(selectedIds)[0]

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === completedFiles.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(completedFiles.map((f) => f.id)))
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    console.log('Exporting:', selectedIds, exportFormat, includeReport, namingRule)
    setIsExporting(false)
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
            <h1 className="text-xl font-bold text-text-primary">导出中心</h1>
            <p className="text-sm text-text-muted">
              选择要导出的音频文件和格式
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-text-muted">
            已选择 {selectedIds.size} / {completedFiles.length} 个文件
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Card className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-text-primary">待导出音频</h3>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === completedFiles.length && completedFiles.length > 0}
                    onChange={selectAll}
                    className="w-4 h-4 rounded border-border-default bg-bg-secondary text-accent-cyan focus:ring-accent-cyan"
                  />
                  全选
                </label>
              </div>
            </div>

            <div className="flex-1 overflow-auto space-y-2">
              {completedFiles.length > 0 ? (
                completedFiles.map((audio) => (
                  <ExportItem
                    key={audio.id}
                    audio={audio}
                    report={displayReports.find((r) => r.audioFileId === audio.id)}
                    selected={selectedIds.has(audio.id)}
                    onToggle={() => toggleSelect(audio.id)}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-text-muted">
                  <CheckCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">暂无已完成的音频文件</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <h3 className="text-sm font-medium text-text-primary mb-4">导出选项</h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-text-secondary mb-2 block">
                  导出格式
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['wav', 'mp3'] as const).map((format) => (
                    <button
                      key={format}
                      onClick={() => setExportFormat(format)}
                      className={cn(
                        'p-3 rounded-lg border transition-all text-center uppercase font-mono text-sm',
                        exportFormat === format
                          ? 'border-accent-cyan bg-accent-cyan/10 text-accent-cyan'
                          : 'border-border-default bg-bg-tertiary/50 text-text-secondary hover:border-border-default/80'
                      )}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>

              <Toggle
                label="包含处理报告"
                checked={includeReport}
                onChange={setIncludeReport}
              />

              {includeReport && (
                <div className="p-3 rounded-lg bg-accent-green/10 border border-accent-green/30">
                  <p className="text-xs text-text-secondary">
                    <FileText className="w-4 h-4 inline mr-2 text-accent-green" />
                    将导出 PDF 格式的处理报告
                  </p>
                </div>
              )}

              <Input
                label="命名规则"
                type="text"
                value={namingRule}
                onChange={(e) => setNamingRule(e.target.value)}
                placeholder="{name}_processed"
              />

              <div className="p-3 rounded-lg bg-bg-tertiary/50">
                <p className="text-xs text-text-muted">
                  示例输出:{' '}
                  <span className="text-text-primary font-mono">
                    {namingRule
                      .replace('{name}', '科技前沿播客_EP01')
                      .replace('{date}', new Date().toISOString().split('T')[0])}
                    .{exportFormat}
                  </span>
                </p>
              </div>
            </div>
          </Card>

          <Card className="flex-1 flex flex-col min-h-0">
            <h3 className="text-sm font-medium text-text-primary mb-4">
              报告预览
            </h3>
            <div className="flex-1 overflow-auto">
              {firstSelectedId ? (
                <ReportPreview audioId={firstSelectedId} />
              ) : (
                <div className="text-center py-8 text-text-muted">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">选择音频查看报告</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <div className="sticky bottom-0 pt-4 border-t border-border-default bg-bg-primary/95 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="text-sm text-text-muted">
            {selectedIds.size > 0 && (
              <span>
                即将导出 {selectedIds.size} 个文件，预计大小约{' '}
                {Math.round(selectedIds.size * 50)} MB
              </span>
            )}
          </div>

          <Button
            variant="primary"
            size="md"
            leftIcon={<Download className="w-4 h-4" />}
            onClick={handleExport}
            disabled={selectedIds.size === 0 || isExporting}
            loading={isExporting}
          >
            {isExporting ? '导出中...' : `批量导出 (${selectedIds.size})`}
          </Button>
        </div>
      </div>
    </div>
  )
}
