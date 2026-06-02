import { useStore } from '@/store/useStore'
import { STATUS_COLORS, STATUS_LABELS, SOURCE_LABELS } from '@/types'
import type { PointStatus, PointSource } from '@/types'
import {
  X,
  MapPin,
  Clock,
  User,
  AlertTriangle,
  Camera,
  MessageSquareWarning,
  Archive,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  HelpCircle,
  Eye,
} from 'lucide-react'
import { useState } from 'react'

const sourceIcons: Record<PointSource, typeof Camera> = {
  inspection_photo: Camera,
  complaint: MessageSquareWarning,
  old_standard: Archive,
}

export default function PointDetail() {
  const { selectedPointId, detailOpen, setDetailOpen, getPointById, getRecordsByPointId, getComplaintsByPointId, updatePointStatus } = useStore()
  const [complaintsExpanded, setComplaintsExpanded] = useState(false)
  const [statusOpinion, setStatusOpinion] = useState('')
  const [showStatusForm, setShowStatusForm] = useState(false)

  if (!detailOpen || !selectedPointId) return null

  const point = getPointById(selectedPointId)
  if (!point) return null

  const records = getRecordsByPointId(selectedPointId)
  const complaints = getComplaintsByPointId(selectedPointId)
  const statusColor = STATUS_COLORS[point.status]
  const SourceIcon = sourceIcons[point.source]

  const handleStatusUpdate = (newStatus: PointStatus) => {
    updatePointStatus(point.id, newStatus, statusOpinion || '状态更新')
    setShowStatusForm(false)
    setStatusOpinion('')
  }

  return (
    <div
      className="drawer-enter h-full w-[420px] flex-shrink-0 border-l overflow-y-auto scrollbar-thin"
      style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}
    >
      <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-4 border-b" style={{ background: 'var(--color-surface)', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full"
            style={{ background: statusColor }}
          />
          <span className="text-sm font-medium" style={{ color: STATUS_LABELS[point.status] ? statusColor : 'var(--color-text)' }}>
            {STATUS_LABELS[point.status]}
          </span>
        </div>
        <button
          onClick={() => setDetailOpen(false)}
          className="p-1.5 rounded-lg transition-colors hover:bg-opacity-20"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <X size={18} />
        </button>
      </div>

      <div className="px-5 py-4 space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MapPin size={16} style={{ color: 'var(--color-accent)' }} />
            <h2 className="text-lg font-semibold">{point.intersectionName}</h2>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono-data" style={{ color: 'var(--color-text-muted)' }}>
            <span>编号 {point.intersectionCode}</span>
            <span>ID {point.id}</span>
            <span>坐标 ({point.coordX}, {point.coordY})</span>
          </div>
        </div>

        {point.coordDrift && (
          <div className="flex items-start gap-2 p-3 rounded-lg border" style={{ background: 'rgba(245, 158, 11, 0.1)', borderColor: 'var(--color-accent)' }}>
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--color-accent)' }} />
            <div className="text-xs" style={{ color: 'var(--color-accent)' }}>{point.coordDriftNote}</div>
          </div>
        )}

        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: 'var(--color-surface-alt)' }}>
          <SourceIcon size={16} style={{ color: 'var(--color-accent)' }} />
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>来源</span>
          <span className="text-sm font-medium">{SOURCE_LABELS[point.source]}</span>
        </div>

        <div>
          <img
            src={point.photoUrl}
            alt="巡检照片"
            className="w-full h-40 object-cover rounded-lg"
            style={{ background: 'var(--color-surface-alt)' }}
          />
          <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <Camera size={12} />
            <span>{point.category}</span>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-medium mb-1.5" style={{ color: 'var(--color-text-muted)' }}>问题描述</h3>
          <p className="text-sm leading-relaxed">{point.description}</p>
        </div>

        {point.suggestion && (
          <div className="p-3 rounded-lg border" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'var(--color-completed)' }}>
            <h3 className="text-xs font-medium mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--color-completed)' }}>
              <CheckCircle2 size={14} />
              处理建议
            </h3>
            <p className="text-sm leading-relaxed whitespace-pre-line">{point.suggestion}</p>
          </div>
        )}

        <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          <div className="flex items-center gap-1.5">
            <User size={13} />
            <span>{point.inspector ?? '未指定'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={13} />
            <span>{point.inspectDate}</span>
          </div>
        </div>

        {complaints.length > 0 && (
          <div>
            <button
              onClick={() => setComplaintsExpanded(!complaintsExpanded)}
              className="flex items-center gap-2 text-sm font-medium w-full text-left"
            >
              <MessageSquareWarning size={15} style={{ color: 'var(--color-pending)' }} />
              <span>关联投诉 ({complaints.length})</span>
              {complaintsExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </button>
            {complaintsExpanded && (
              <div className="mt-2 space-y-2">
                {complaints.map((c) => (
                  <div
                    key={c.id}
                    className={`p-2.5 rounded-lg text-xs ${c.isDuplicate ? 'override-stripe' : ''}`}
                    style={{ background: 'var(--color-surface-alt)' }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{c.complainant}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-data">{c.date}</span>
                        {c.isDuplicate && (
                          <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(245, 158, 11, 0.2)', color: 'var(--color-accent)' }}>
                            重复
                          </span>
                        )}
                      </div>
                    </div>
                    <p style={{ color: 'var(--color-text-muted)' }}>{c.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div>
          <h3 className="text-xs font-medium mb-3 flex items-center gap-1.5" style={{ color: 'var(--color-text-muted)' }}>
            <Clock size={14} />
            处理记录
          </h3>
          <div className="space-y-0">
            {records.map((r) => (
              <div key={r.id} className="timeline-line pl-5 pb-4 relative">
                <div
                  className="absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 flex items-center justify-center"
                  style={{
                    borderColor: r.isOverride ? 'var(--color-accent)' : 'var(--color-border)',
                    background: r.isOverride ? 'rgba(245, 158, 11, 0.2)' : 'var(--color-surface)',
                  }}
                >
                  {r.isOverride && <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--color-accent)' }} />}
                </div>
                <div className={`p-2.5 rounded-lg ${r.isOverride ? 'override-stripe' : ''}`} style={{ background: 'var(--color-surface-alt)' }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{r.action}</span>
                    <div className="flex items-center gap-2">
                      {r.isOverride && (
                        <span className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgba(245, 158, 11, 0.2)', color: 'var(--color-accent)' }}>
                          已覆盖
                        </span>
                      )}
                      <span className="font-mono-data text-xs" style={{ color: 'var(--color-text-muted)' }}>{r.date}</span>
                    </div>
                  </div>
                  <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    <span>{r.operator}</span>
                  </div>
                  {r.isOverride && r.oldPlan && (
                    <div className="mt-1.5 text-xs p-1.5 rounded" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
                      <span style={{ color: 'var(--color-need-onsite)' }}>旧方案：</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>{r.oldPlan}</span>
                    </div>
                  )}
                  {r.isOverride && r.newPlan && (
                    <div className="mt-1 text-xs p-1.5 rounded" style={{ background: 'rgba(16, 185, 129, 0.1)' }}>
                      <span style={{ color: 'var(--color-completed)' }}>新方案：</span>
                      <span style={{ color: 'var(--color-text-muted)' }}>{r.newPlan}</span>
                    </div>
                  )}
                  {r.opinion && (
                    <p className="mt-1.5 text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{r.opinion}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          {!showStatusForm ? (
            <button
              onClick={() => setShowStatusForm(true)}
              className="w-full py-2.5 rounded-lg text-sm font-medium transition-all duration-200 hover:opacity-90"
              style={{ background: 'var(--color-accent)', color: '#0F172A' }}
            >
              更新状态
            </button>
          ) : (
            <div className="space-y-3">
              <textarea
                value={statusOpinion}
                onChange={(e) => setStatusOpinion(e.target.value)}
                placeholder="输入处理意见..."
                className="w-full px-3 py-2 rounded-lg text-sm resize-none border outline-none"
                style={{ background: 'var(--color-surface-alt)', borderColor: 'var(--color-border)', color: 'var(--color-text)' }}
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleStatusUpdate('completed')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--color-completed)' }}
                >
                  <CheckCircle2 size={14} />
                  已处理
                </button>
                <button
                  onClick={() => handleStatusUpdate('pending_verify')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'rgba(249, 115, 22, 0.15)', color: 'var(--color-pending)' }}
                >
                  <HelpCircle size={14} />
                  待核实
                </button>
                <button
                  onClick={() => handleStatusUpdate('need_onsite')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: 'rgba(239, 68, 68, 0.15)', color: 'var(--color-need-onsite)' }}
                >
                  <Eye size={14} />
                  需现场复看
                </button>
              </div>
              <button
                onClick={() => { setShowStatusForm(false); setStatusOpinion('') }}
                className="w-full py-2 rounded-lg text-xs transition-colors"
                style={{ color: 'var(--color-text-muted)' }}
              >
                取消
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
