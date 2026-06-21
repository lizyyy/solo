import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Cpu,
  User,
  UserCheck,
  FileText,
  GitCompare,
  Music,
  DollarSign,
  Percent,
  Calendar,
  Paperclip,
  Image,
  Download,
  ExternalLink,
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import {
  STATUS_LABELS,
  SOURCE_LABELS,
  JUDGMENT_TYPE_LABELS,
  type RecordStatus,
  type JudgmentType,
  type AttachmentInfo,
} from '@/types'

const JUDGMENT_ICONS: Record<JudgmentType, typeof Cpu> = {
  system_auto: Cpu,
  manual_override: UserCheck,
  note_added: FileText,
  diff_detected: GitCompare,
}

const JUDGMENT_COLORS: Record<JudgmentType, string> = {
  system_auto: 'text-muted border-muted/40 bg-muted/10',
  manual_override: 'text-neon border-neon/40 bg-neon/10',
  note_added: 'text-blue-400 border-blue-400/40 bg-blue-400/10',
  diff_detected: 'text-warning border-warning/40 bg-warning/10',
}

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentRecord, judgments, fetchRecord, fetchJudgments, updateRecord } = useStore()
  const [overrideStatus, setOverrideStatus] = useState<RecordStatus | ''>('')
  const [overrideReason, setOverrideReason] = useState('')

  useEffect(() => {
    if (id) {
      fetchRecord(id)
      fetchJudgments(id)
    }
  }, [id])

  if (!currentRecord) {
    return (
      <div className="card text-center py-12">
        <div className="animate-pulse text-neon text-sm">加载中...</div>
      </div>
    )
  }

  const handleOverride = () => {
    if (!overrideStatus || !overrideReason.trim()) return
    updateRecord(currentRecord.id, {
      status: overrideStatus,
      manualOverrideReason: overrideReason.trim(),
    })
    setOverrideStatus('')
    setOverrideReason('')
    if (id) {
      fetchRecord(id)
      fetchJudgments(id)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-sm text-muted hover:text-neon transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        返回工作台
      </button>

      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Music className="h-5 w-5 text-neon" />
              <h2 className="text-xl font-bold text-white">{currentRecord.trackName}</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className={`badge-${currentRecord.status}`}>
                {STATUS_LABELS[currentRecord.status]}
              </span>
              <span className="text-xs text-muted bg-surface-elevated px-2 py-0.5 rounded">
                {SOURCE_LABELS[currentRecord.source]}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-t border-b border-surface-border">
          <InfoItem icon={User} label="演出者" value={currentRecord.artist} />
          <InfoItem icon={DollarSign} label="票房收入" value={`¥${currentRecord.revenue.toLocaleString()}`} valueClass="text-neon" />
          <InfoItem icon={Percent} label="分账比例" value={currentRecord.shareRatio != null ? `${(currentRecord.shareRatio * 100).toFixed(0)}%` : '缺失'} valueClass={currentRecord.shareRatio != null ? 'text-neon' : 'text-danger'} />
          <InfoItem icon={DollarSign} label="分账金额" value={currentRecord.shareAmount != null ? `¥${currentRecord.shareAmount.toLocaleString()}` : '待定'} valueClass={currentRecord.shareAmount != null ? 'text-white' : 'text-danger'} />
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <span className="text-xs text-muted">原始备注（Excel原样保留）</span>
            <p className="text-sm text-gray-300 mt-1 bg-surface-elevated rounded-lg px-3 py-2 min-h-[36px]">
              {currentRecord.originalNote || <span className="text-muted/50">无</span>}
            </p>
          </div>
          <div>
            <span className="text-xs text-muted">当前备注</span>
            <p className="text-sm text-gray-200 mt-1 bg-surface-elevated rounded-lg px-3 py-2 min-h-[36px]">
              {currentRecord.currentNote || <span className="text-muted/50">无</span>}
            </p>
          </div>
        </div>

        {currentRecord.attachments && currentRecord.attachments.length > 0 && (
          <div className="mt-4 pt-4 border-t border-surface-border">
            <div className="flex items-center gap-2 mb-3">
              <Paperclip className="h-3.5 w-3.5 text-neon" />
              <span className="text-xs text-muted">附件材料（{currentRecord.attachments.length}）</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentRecord.attachments.map((att) => (
                <AttachmentCard key={att.id} att={att} />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-1.5 rounded-full bg-neon" />
          <h3 className="text-sm font-medium text-white">判断时间线</h3>
        </div>

        {judgments.length === 0 ? (
          <p className="text-xs text-muted">暂无判断记录</p>
        ) : (
          <div className="relative">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-gradient-to-b from-neon/40 via-muted/20 to-transparent" />
            <div className="space-y-4">
              {judgments.map((j) => {
                const Icon = JUDGMENT_ICONS[j.type]
                const colors = JUDGMENT_COLORS[j.type]
                return (
                  <div key={j.id} className="relative pl-10">
                    <div className={`absolute left-[7px] top-1 w-[18px] h-[18px] rounded-full border-2 flex items-center justify-center ${colors}`}>
                      <Icon className="h-2.5 w-2.5" />
                    </div>
                    <div className="ml-2">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs font-medium ${colors.split(' ')[0]}`}>
                          {JUDGMENT_TYPE_LABELS[j.type]}
                        </span>
                        <span className="text-xs text-muted font-mono">#{j.step}</span>
                      </div>
                      <p className="text-sm text-gray-300">{j.description}</p>
                      <p className="text-xs text-muted mt-0.5">{j.result}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <Calendar className="h-3 w-3 text-muted/40" />
                        <span className="text-xs text-muted/60 font-mono">{j.createdAt}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {currentRecord.status === 'needs_confirmation' && (
        <div className="card border-danger/20">
          <div className="flex items-center gap-2 mb-4">
            <UserCheck className="h-4 w-4 text-danger" />
            <h3 className="text-sm font-medium text-danger">人工标注</h3>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted block mb-1">标注结果</label>
              <select
                value={overrideStatus}
                onChange={(e) => setOverrideStatus(e.target.value as RecordStatus)}
                className="input-field w-full text-sm"
              >
                <option value="">请选择...</option>
                <option value="smooth">确认 — 顺利</option>
                <option value="old_standard">退回 — 旧口径</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-muted block mb-1">标注原因（必填）</label>
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="请说明标注原因，后续接手人员可查看"
                className="input-field w-full text-sm min-h-[80px] resize-y"
              />
            </div>

            <button
              onClick={handleOverride}
              disabled={!overrideStatus || !overrideReason.trim()}
              className="btn-primary w-full disabled:opacity-30 disabled:cursor-not-allowed"
            >
              提交标注
            </button>
          </div>
        </div>
      )}

      {currentRecord.status === 'old_standard' && currentRecord.originalNote !== currentRecord.currentNote && (
        <div className="card border-warning/20">
          <div className="flex items-center gap-2 mb-3">
            <GitCompare className="h-4 w-4 text-warning" />
            <h3 className="text-sm font-medium text-warning">差异说明</h3>
          </div>
          <div className="space-y-2">
            <div>
              <span className="text-xs text-muted">原始备注</span>
              <p className="text-sm text-gray-400 line-through bg-surface-elevated px-3 py-2 rounded mt-1">
                {currentRecord.originalNote}
              </p>
            </div>
            <div>
              <span className="text-xs text-neon">当前备注</span>
              <p className="text-sm text-neon bg-neon-glow px-3 py-2 rounded mt-1">
                {currentRecord.currentNote}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoItem({
  icon: Icon,
  label,
  value,
  valueClass = 'text-white',
}: {
  icon: typeof DollarSign
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs text-muted mb-1">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <div className={`text-sm font-medium font-mono ${valueClass}`}>{value}</div>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function AttachmentCard({ att }: { att: AttachmentInfo }) {
  const url = `/api/attachments/${encodeURIComponent(att.storedPath)}`

  if (att.fileType === 'image') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block group relative rounded-lg overflow-hidden border border-surface-border bg-surface-elevated hover:border-neon/40 transition-colors"
      >
        <div className="aspect-video flex items-center justify-center overflow-hidden">
          <img
            src={url}
            alt={att.fileName}
            className="max-w-full max-h-full object-contain"
          />
        </div>
        <div className="p-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <Image className="h-3 w-3 text-neon flex-shrink-0" />
            <span className="text-xs text-gray-300 truncate">{att.fileName}</span>
          </div>
          <ExternalLink className="h-3 w-3 text-muted flex-shrink-0 group-hover:text-neon transition-colors" />
        </div>
      </a>
    )
  }

  if (att.fileType === 'audio') {
    return (
      <div className="rounded-lg border border-surface-border bg-surface-elevated p-3">
        <div className="flex items-center gap-2 mb-2">
          <Music className="h-4 w-4 text-neon" />
          <span className="text-xs text-gray-300 truncate flex-1">{att.fileName}</span>
          <span className="text-xs text-muted">{formatFileSize(att.fileSize)}</span>
        </div>
        <audio controls src={url} className="w-full h-8" />
      </div>
    )
  }

  const TypeIcon = att.fileType === 'pdf' ? FileText : att.fileType === 'text' ? FileText : Paperclip

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-3 rounded-lg border border-surface-border bg-surface-elevated hover:border-neon/40 hover:bg-surface-hover transition-colors group"
    >
      <div className="w-10 h-10 rounded-lg bg-neon/10 flex items-center justify-center flex-shrink-0">
        <TypeIcon className="h-5 w-5 text-neon" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate group-hover:text-neon transition-colors">{att.fileName}</p>
        <p className="text-xs text-muted mt-0.5">{formatFileSize(att.fileSize)}</p>
      </div>
      <Download className="h-4 w-4 text-muted group-hover:text-neon transition-colors flex-shrink-0" />
    </a>
  )
}
