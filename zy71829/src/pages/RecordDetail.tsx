import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Clock,
  User,
  AlertTriangle,
  Copy,
  FileText,
  ClipboardList,
  Check,
  X,
  ArrowRight,
  RotateCcw,
  ChevronRight,
  Shield,
} from 'lucide-react'
import { useQueueStore } from '@/store'
import type { StatusType, ActionType } from '@shared/types'

const statusColors: Record<StatusType, string> = {
  待草表: 'bg-status-draft/20 text-status-draft border-status-draft/30',
  待确认: 'bg-status-confirm/20 text-status-confirm border-status-confirm/30',
  已完成: 'bg-status-done/20 text-status-done border-status-done/30',
  已驳回: 'bg-status-reject/20 text-status-reject border-status-reject/30',
}

const statusDotColors: Record<StatusType, string> = {
  待草表: 'bg-status-draft',
  待确认: 'bg-status-confirm',
  已完成: 'bg-status-done',
  已驳回: 'bg-status-reject',
}

const actionIcons: Record<ActionType, typeof FileText> = {
  创建: FileText,
  状态变更: ArrowRight,
  人工确认: Check,
  驳回: X,
  关联: Copy,
  重复标记: AlertTriangle,
}

const actionColors: Record<ActionType, string> = {
  创建: 'text-status-draft',
  状态变更: 'text-status-confirm',
  人工确认: 'text-status-done',
  驳回: 'text-status-reject',
  关联: 'text-port-orange',
  重复标记: 'text-status-reject',
}

interface ActionModalProps {
  open: boolean
  title: string
  onClose: () => void
  onSubmit: (changedBy: string, reason: string) => void
  loading: boolean
}

function ActionModal({ open, title, onClose, onSubmit, loading }: ActionModalProps) {
  const [changedBy, setChangedBy] = useState('负责人陈')
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open) {
      setChangedBy('负责人陈')
      setReason('')
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-port-surface border border-port-border rounded-xl shadow-2xl w-full max-w-md mx-4">
        <div className="px-6 py-4 border-b border-port-border">
          <h3 className="text-base font-semibold text-port-text">{title}</h3>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-port-muted mb-1.5">操作人</label>
            <input
              type="text"
              value={changedBy}
              onChange={(e) => setChangedBy(e.target.value)}
              className="w-full px-3 py-2 bg-port-card border border-port-border rounded-lg text-port-text text-sm focus:outline-none focus:border-port-orange transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-port-muted mb-1.5">原因说明</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-port-card border border-port-border rounded-lg text-port-text text-sm resize-none focus:outline-none focus:border-port-orange transition-colors"
              placeholder="请输入操作原因..."
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-port-border flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-port-muted hover:text-port-text bg-port-card border border-port-border rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => onSubmit(changedBy, reason)}
            disabled={loading || !reason.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-port-orange hover:bg-port-orange-light rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '提交中...' : '确认'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RecordDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { currentRecord, loading, fetchRecordDetail, updateStatus } = useQueueStore()

  const [modalOpen, setModalOpen] = useState(false)
  const [modalTitle, setModalTitle] = useState('')
  const [modalTargetStatus, setModalTargetStatus] = useState<StatusType | null>(null)

  useEffect(() => {
    if (id) fetchRecordDetail(id)
  }, [id, fetchRecordDetail])

  const openActionModal = useCallback((title: string, target: StatusType) => {
    setModalTitle(title)
    setModalTargetStatus(target)
    setModalOpen(true)
  }, [])

  const handleSubmitAction = useCallback(
    async (changedBy: string, reason: string) => {
      if (!id || !modalTargetStatus) return
      await updateStatus(id, { toStatus: modalTargetStatus, changedBy, reason })
      setModalOpen(false)
    },
    [id, modalTargetStatus, updateStatus],
  )

  if (loading && !currentRecord) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-port-orange border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-port-muted">加载中...</p>
        </div>
      </div>
    )
  }

  if (!currentRecord) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-port-muted">未找到记录</p>
          <button
            onClick={() => navigate('/')}
            className="mt-3 text-sm text-port-orange hover:underline"
          >
            返回看板
          </button>
        </div>
      </div>
    )
  }

  const r = currentRecord
  const statusChanges = [...r.statusChanges].sort(
    (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime(),
  )

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-sm text-port-muted hover:text-port-text transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        返回看板
      </button>

      <div className="bg-port-card border border-port-border rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-port-text tracking-wide">{r.activityId}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold border ${statusColors[r.status]}`}
              >
                {r.status}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-medium bg-port-surface border border-port-border text-port-muted">
                <FileText className="w-3 h-3" />
                {r.source}
              </span>
            </div>
          </div>
          <div className="text-right text-xs text-port-muted space-y-1 shrink-0">
            <div className="flex items-center gap-1.5 justify-end">
              <User className="w-3.5 h-3.5" />
              <span>{r.submittedBy}</span>
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              <Clock className="w-3.5 h-3.5" />
              <span>{new Date(r.submittedAt).toLocaleString('zh-CN')}</span>
            </div>
          </div>
        </div>

        <p className="text-sm text-port-text/80 leading-relaxed whitespace-pre-wrap">{r.content}</p>

        {r.isAnomaly && r.anomalyReason && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-status-reject/10 border border-status-reject/30">
            <AlertTriangle className="w-5 h-5 text-status-reject shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-status-reject">异常标记</p>
              <p className="text-sm text-status-reject/80 mt-0.5">{r.anomalyReason}</p>
            </div>
          </div>
        )}

        {r.isDuplicate && (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-port-orange/10 border border-port-orange/30">
            <Copy className="w-5 h-5 text-port-orange shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-port-orange">重复记录</p>
              <p className="text-sm text-port-orange/80 mt-0.5">
                此记录与已有记录重复
                {r.relatedRecordId && (
                  <button
                    onClick={() => navigate(`/record/${r.relatedRecordId}`)}
                    className="ml-2 text-port-orange hover:underline inline-flex items-center gap-0.5"
                  >
                    查看原记录 <ChevronRight className="w-3 h-3" />
                  </button>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-port-card border border-port-border rounded-xl p-6">
            <h2 className="text-base font-semibold text-port-text mb-5 flex items-center gap-2">
              <Clock className="w-4.5 h-4.5 text-port-orange" />
              状态流转
            </h2>
            {statusChanges.length === 0 ? (
              <p className="text-sm text-port-muted py-4 text-center">暂无状态变更记录</p>
            ) : (
              <div className="relative">
                {statusChanges.map((sc, i) => {
                  const toStatus = sc.toStatus as StatusType
                  const isLast = i === statusChanges.length - 1
                  return (
                    <div key={sc.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={`w-3.5 h-3.5 rounded-full ${statusDotColors[toStatus]} ring-4 ring-port-card shrink-0 mt-1.5`}
                        />
                        {!isLast && (
                          <div className="w-px flex-1 bg-port-border my-1" />
                        )}
                      </div>
                      <div className={`pb-6 flex-1 ${isLast ? 'pb-0' : ''}`}>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded ${statusColors[toStatus]}`}
                          >
                            {sc.toStatus}
                          </span>
                          <span className="text-xs text-port-muted">
                            ← {sc.fromStatus}
                          </span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-3 text-xs text-port-muted flex-wrap">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {sc.changedBy}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(sc.changedAt).toLocaleString('zh-CN')}
                          </span>
                        </div>
                        {sc.reason && (
                          <p className="mt-1.5 text-xs text-port-text/60 bg-port-bg/50 rounded px-2.5 py-1.5">
                            {sc.reason}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-port-card border border-port-border rounded-xl p-6">
            <h2 className="text-base font-semibold text-port-text mb-4 flex items-center gap-2">
              <Shield className="w-4.5 h-4.5 text-port-orange" />
              审计日志
            </h2>
            {r.auditLogs.length === 0 ? (
              <p className="text-sm text-port-muted py-4 text-center">暂无审计日志</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-port-border text-port-muted text-xs">
                      <th className="text-left py-2.5 pr-4 font-medium">操作类型</th>
                      <th className="text-left py-2.5 pr-4 font-medium">操作人</th>
                      <th className="text-left py-2.5 pr-4 font-medium">详情</th>
                      <th className="text-left py-2.5 font-medium">时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.auditLogs.map((log) => {
                      const Icon = actionIcons[log.action]
                      const color = actionColors[log.action]
                      return (
                        <tr
                          key={log.id}
                          className="border-b border-port-border/50 last:border-0 hover:bg-port-hover/30 transition-colors"
                        >
                          <td className="py-2.5 pr-4">
                            <span className={`inline-flex items-center gap-1.5 ${color}`}>
                              <Icon className="w-3.5 h-3.5" />
                              {log.action}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 text-port-muted">{log.operator}</td>
                          <td className="py-2.5 pr-4 text-port-text/70 max-w-[200px] truncate">
                            {log.detail}
                          </td>
                          <td className="py-2.5 text-port-muted whitespace-nowrap">
                            {new Date(log.operatedAt).toLocaleString('zh-CN')}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-port-card border border-port-border rounded-xl p-5">
            <h2 className="text-base font-semibold text-port-text mb-4 flex items-center gap-2">
              <ClipboardList className="w-4.5 h-4.5 text-port-orange" />
              关联记录
            </h2>
            {r.relatedRecords.length === 0 ? (
              <p className="text-sm text-port-muted py-3 text-center">无关联记录</p>
            ) : (
              <div className="space-y-2">
                {r.relatedRecords.map((rec) => (
                  <button
                    key={rec.id}
                    onClick={() => navigate(`/record/${rec.id}`)}
                    className="w-full text-left p-3 bg-port-bg/50 border border-port-border/50 rounded-lg hover:border-port-orange/40 hover:bg-port-hover/30 transition-all group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-port-text truncate">
                        {rec.activityId}
                      </span>
                      <ChevronRight className="w-4 h-4 text-port-muted group-hover:text-port-orange transition-colors shrink-0" />
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${statusColors[rec.status]}`}
                      >
                        {rec.status}
                      </span>
                      <span className="text-xs text-port-muted">{rec.source}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="bg-port-card border border-port-border rounded-xl p-5">
            <h2 className="text-base font-semibold text-port-text mb-4">操作</h2>
            {r.status === '已完成' ? (
              <div className="flex items-center justify-center gap-2 py-4">
                <Check className="w-5 h-5 text-status-done" />
                <span className="text-sm font-medium text-status-done">已完成</span>
              </div>
            ) : (
              <div className="space-y-2">
                {r.status === '待草表' && (
                  <button
                    onClick={() => openActionModal('推进到待确认', '待确认')}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-port-orange hover:bg-port-orange-light text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    <ArrowRight className="w-4 h-4" />
                    推进到待确认
                  </button>
                )}
                {r.status === '待确认' && (
                  <>
                    <button
                      onClick={() => openActionModal('确认完成', '已完成')}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-status-done/20 hover:bg-status-done/30 text-status-done text-sm font-medium rounded-lg border border-status-done/30 transition-colors disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" />
                      确认完成
                    </button>
                    <button
                      onClick={() => openActionModal('驳回', '已驳回')}
                      disabled={loading}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-status-reject/20 hover:bg-status-reject/30 text-status-reject text-sm font-medium rounded-lg border border-status-reject/30 transition-colors disabled:opacity-50"
                    >
                      <X className="w-4 h-4" />
                      驳回
                    </button>
                  </>
                )}
                {r.status === '已驳回' && (
                  <button
                    onClick={() => openActionModal('重新提交到待草表', '待草表')}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-status-draft/20 hover:bg-status-draft/30 text-status-draft text-sm font-medium rounded-lg border border-status-draft/30 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="w-4 h-4" />
                    重新提交到待草表
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <ActionModal
        open={modalOpen}
        title={modalTitle}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmitAction}
        loading={loading}
      />
    </div>
  )
}
