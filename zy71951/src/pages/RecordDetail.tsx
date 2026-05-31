import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  MapPin,
  Calendar,
  User,
  Clock,
  FileText,
  Paperclip,
  Edit3,
  History,
  Download,
} from 'lucide-react'
import api from '@/utils/api'
import type { InspectionRecord, RecordStatus, CreateCorrectionRequest } from '@/types'
import { ATTACHMENT_SOURCE_LABELS } from '@/types'
import StatusBadge from '@/components/StatusBadge'
import AuditTimeline from '@/components/AuditTimeline'
import JudgmentCard from '@/components/JudgmentCard'
import CorrectionDialog from '@/components/CorrectionDialog'
import EmptyState from '@/components/EmptyState'
import { useAppStore } from '@/store/useAppStore'
import { cn } from '@/lib/utils'

function formatFileSize(bytes: number) {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

const CORRECTION_FIELD_LABELS: Record<string, string> = {
  towerId: '杆塔编号',
  towerName: '杆塔名称',
  flightDate: '飞行日期',
  flightTime: '飞行时间',
  pilotName: '飞手姓名',
}

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currentUser = useAppStore((s) => s.currentUser)

  const [record, setRecord] = useState<InspectionRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [correctionOpen, setCorrectionOpen] = useState(false)
  const [submittingCorrection, setSubmittingCorrection] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api
      .get<InspectionRecord>(`/records/${id}`)
      .then(setRecord)
      .catch(() => setRecord(null))
      .finally(() => setLoading(false))
  }, [id])

  async function handleConfirmJudgment(judgmentId: string) {
    if (!id) return
    setConfirmingId(judgmentId)
    try {
      await api.post(`/records/${id}/judgments/${judgmentId}/confirm`, {
        judgmentId,
        confirmedBy: currentUser.name,
      })
      setRecord((prev) =>
        prev
          ? {
              ...prev,
              judgments: prev.judgments.map((j) =>
                j.id === judgmentId ? { ...j, confirmed: true, confirmedBy: currentUser.name, confirmedAt: new Date().toISOString() } : j
              ),
            }
          : prev
      )
    } finally {
      setConfirmingId(null)
    }
  }

  async function handleSubmitCorrection(data: CreateCorrectionRequest) {
    if (!id) return
    setSubmittingCorrection(true)
    try {
      await api.post(`/records/${id}/corrections`, { ...data, correctedBy: currentUser.name })
      const updated = await api.get<InspectionRecord>(`/records/${id}`)
      setRecord(updated)
      setCorrectionOpen(false)
    } catch {
      // error handled silently
    } finally {
      setSubmittingCorrection(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-6 h-6 border-2 border-steel border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!record) {
    return (
      <div className="flex items-center justify-center h-96">
        <EmptyState title="记录不存在" description="该巡检记录可能已被删除" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button type="button" className="p-2 rounded-md hover:bg-gray-100 transition-colors" onClick={() => navigate('/records')}>
          <ArrowLeft className="w-5 h-5 text-gray-500" />
        </button>
        <h1 className="text-xl font-semibold text-primary">巡检记录详情</h1>
      </div>

      <div className="card card-body">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-steel" />
              <span className="font-mono text-lg font-bold text-primary">{record.towerId}</span>
              <span className="text-gray-500">—</span>
              <span className="text-primary font-medium">{record.towerName}</span>
              <StatusBadge status={record.status as RecordStatus} />
            </div>
            <div className="flex flex-wrap items-center gap-5 text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                {record.flightDate} {record.flightTime}
              </span>
              <span className="flex items-center gap-1.5">
                <User className="w-4 h-4" />
                {record.pilotName}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                创建于 {formatDateTime(record.createdAt)}
              </span>
            </div>
          </div>
          <button type="button" className="btn-secondary text-sm" onClick={() => setCorrectionOpen(true)}>
            <Edit3 className="w-4 h-4" />
            人工更正
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <FileText className="w-4 h-4 text-accent" />
              判断理由
              {record.judgments.length > 0 && (
                <span className="text-xs text-gray-400 ml-1">({record.judgments.length}条)</span>
              )}
            </div>
            <div className="card-body space-y-3">
              {record.judgments.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">无异常判断</p>
              ) : (
                record.judgments.map((j) => (
                  <JudgmentCard
                    key={j.id}
                    judgment={j}
                    onConfirm={handleConfirmJudgment}
                    confirming={confirmingId === j.id}
                  />
                ))
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-steel" />
              附件
              {record.attachments.length > 0 && (
                <span className="text-xs text-gray-400 ml-1">({record.attachments.length})</span>
              )}
            </div>
            <div className="card-body">
              {record.attachments.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">暂无附件</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {record.attachments.map((att) => (
                    <div key={att.id} className="rounded-lg border border-gray-100 p-3 hover:shadow-sm transition-shadow">
                      <div className="flex items-start gap-2">
                        <FileText className="w-8 h-8 text-gray-300 shrink-0 mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-primary font-medium truncate">{att.fileName}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{formatFileSize(att.fileSize)}</p>
                        </div>
                        <a
                          href={att.filePath}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1 rounded hover:bg-gray-100 transition-colors"
                        >
                          <Download className="w-4 h-4 text-gray-400" />
                        </a>
                      </div>
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-50">
                        <span
                          className={cn(
                            'text-xs px-1.5 py-0.5 rounded',
                            att.source === 'original' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                          )}
                        >
                          {ATTACHMENT_SOURCE_LABELS[att.source]}
                        </span>
                        <span className="text-xs text-gray-400">到达：{formatDateTime(att.arrivedAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-steel" />
              人工更正
              {record.corrections.length > 0 && (
                <span className="text-xs text-gray-400 ml-1">({record.corrections.length})</span>
              )}
            </div>
            <div className="card-body">
              {record.corrections.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">暂无人工更正</p>
              ) : (
                <div className="space-y-4">
                  {record.corrections.map((corr) => (
                    <div key={corr.id} className="rounded-lg border border-gray-100 p-4">
                      <div className="text-sm font-medium text-primary mb-3">
                        {CORRECTION_FIELD_LABELS[corr.fieldName] || corr.fieldName}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-md bg-red-50 border border-red-100 p-3">
                          <div className="text-xs text-red-400 mb-1">原值</div>
                          <div className="text-sm text-red-800 font-mono break-all">{corr.oldValue || '（空）'}</div>
                        </div>
                        <div className="rounded-md bg-emerald-50 border border-emerald-100 p-3">
                          <div className="text-xs text-emerald-400 mb-1">新值</div>
                          <div className="text-sm text-emerald-800 font-mono break-all">{corr.newValue}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-gray-400">
                        <span>原因：{corr.reason}</span>
                        <span>更正人：{corr.correctedBy}</span>
                        <span>{formatDateTime(corr.correctedAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="card-header flex items-center gap-2">
              <History className="w-4 h-4 text-steel" />
              留痕时间线
            </div>
            <div className="card-body">
              {record.auditTrail.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">暂无留痕记录</p>
              ) : (
                <AuditTimeline events={record.auditTrail} />
              )}
            </div>
          </div>
        </div>
      </div>

      <CorrectionDialog
        open={correctionOpen}
        onClose={() => setCorrectionOpen(false)}
        onSubmit={handleSubmitCorrection}
        submitting={submittingCorrection}
      />
    </div>
  )
}
