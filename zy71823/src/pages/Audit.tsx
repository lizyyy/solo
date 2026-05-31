import { useState } from 'react'
import { useAppStore } from '@/store/useAppStore'
import {
  ChevronDown,
  ChevronUp,
  Check,
  X,
  AlertTriangle,
  FileCheck,
} from 'lucide-react'
import type { JudgmentType, AuditStatus } from '@/types'
import { JUDGMENT_LABELS, STATUS_LABELS, TYPE_LABELS } from '@/types'

const JUDGMENT_COLORS: Record<JudgmentType, string> = {
  supplementary: 'border-l-emerald-500',
  conclusion_changed: 'border-l-amber-500',
}

const JUDGMENT_BADGE: Record<JudgmentType, string> = {
  supplementary: 'bg-emerald-900/60 text-emerald-300',
  conclusion_changed: 'bg-amber-900/60 text-amber-300',
}

const STATUS_BADGE: Record<AuditStatus, string> = {
  pending: 'bg-slate-800 text-slate-300',
  confirmed: 'bg-zinc-700 text-zinc-300',
  rejected: 'bg-rose-900/60 text-rose-300',
}

export default function Audit() {
  const auditResults = useAppStore((s) => s.auditResults)
  const evidences = useAppStore((s) => s.evidences)
  const confirmAudit = useAppStore((s) => s.confirmAudit)
  const rejectAudit = useAppStore((s) => s.rejectAudit)

  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [confirmBy, setConfirmBy] = useState('')
  const [confirmNote, setConfirmNote] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [correctedConclusion, setCorrectedConclusion] = useState('')

  const pendingResults = auditResults.filter((r) => r.status === 'pending')
  const resolvedResults = auditResults.filter((r) => r.status !== 'pending')

  const getEvidence = (id: string) => evidences.find((e) => e.id === id)

  const handleConfirm = (auditId: string) => {
    if (!confirmBy.trim()) return
    confirmAudit(auditId, confirmBy.trim(), confirmNote.trim())
    setConfirming(null)
    setConfirmBy('')
    setConfirmNote('')
  }

  const handleReject = (auditId: string) => {
    if (!rejectReason.trim()) return
    rejectAudit(auditId, rejectReason.trim(), correctedConclusion.trim())
    setRejecting(null)
    setRejectReason('')
    setCorrectedConclusion('')
  }

  const renderCard = (result: typeof auditResults[0]) => {
    const evidence = getEvidence(result.evidenceId)
    if (!evidence) return null

    const isExpanded = expanded === result.id

    return (
      <div
        key={result.id}
        className={`border-l-3 ${JUDGMENT_COLORS[result.judgment]} bg-zinc-900 border border-zinc-800 rounded-r-lg`}
      >
        <button
          onClick={() => setExpanded(isExpanded ? null : result.id)}
          className="w-full text-left px-4 py-3 flex items-start gap-3"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${JUDGMENT_BADGE[result.judgment]}`}
              >
                {JUDGMENT_LABELS[result.judgment]}
              </span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_BADGE[result.status]}`}
              >
                {STATUS_LABELS[result.status]}
              </span>
              <span className="text-[10px] text-zinc-600">
                {TYPE_LABELS[evidence.type]}
              </span>
            </div>
            <div className="text-sm font-medium text-zinc-200 truncate">
              {evidence.activityName}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5 truncate">
              {evidence.content.slice(0, 60)}...
            </div>
          </div>
          {isExpanded ? (
            <ChevronUp size={14} className="text-zinc-600 mt-1 shrink-0" />
          ) : (
            <ChevronDown size={14} className="text-zinc-600 mt-1 shrink-0" />
          )}
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 border-t border-zinc-800/60 pt-3">
            <div className="bg-zinc-950/60 rounded p-3 mb-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertTriangle
                  size={12}
                  className={
                    result.judgment === 'conclusion_changed'
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }
                />
                <span className="text-xs font-medium text-zinc-300">
                  判断理由
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {result.reasoning}
              </p>
            </div>

            <div className="bg-zinc-950/60 rounded p-3 mb-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                <FileCheck size={12} className="text-sky-400" />
                <span className="text-xs font-medium text-zinc-300">
                  下一步建议
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {result.nextStep}
              </p>
            </div>

            {result.status === 'pending' && (
              <div className="flex items-center gap-2">
                {confirming === result.id ? (
                  <div className="flex-1 space-y-2">
                    <input
                      value={confirmBy}
                      onChange={(e) => setConfirmBy(e.target.value)}
                      placeholder="确认人姓名 *"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600"
                    />
                    <textarea
                      value={confirmNote}
                      onChange={(e) => setConfirmNote(e.target.value)}
                      placeholder="确认备注（可选）"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 resize-none h-14"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleConfirm(result.id)}
                        className="px-3 py-1.5 text-xs bg-emerald-700 text-white rounded hover:bg-emerald-600 transition-colors"
                      >
                        提交确认
                      </button>
                      <button
                        onClick={() => {
                          setConfirming(null)
                          setConfirmBy('')
                          setConfirmNote('')
                        }}
                        className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : rejecting === result.id ? (
                  <div className="flex-1 space-y-2">
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="驳回原因 *"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 resize-none h-14"
                    />
                    <textarea
                      value={correctedConclusion}
                      onChange={(e) => setCorrectedConclusion(e.target.value)}
                      placeholder="修正结论（可选）"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 resize-none h-14"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReject(result.id)}
                        className="px-3 py-1.5 text-xs bg-rose-700 text-white rounded hover:bg-rose-600 transition-colors"
                      >
                        提交驳回
                      </button>
                      <button
                        onClick={() => {
                          setRejecting(null)
                          setRejectReason('')
                          setCorrectedConclusion('')
                        }}
                        className="px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => setConfirming(result.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-emerald-900/50 text-emerald-300 rounded hover:bg-emerald-900/80 transition-colors"
                    >
                      <Check size={12} />
                      确认
                    </button>
                    <button
                      onClick={() => setRejecting(result.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-rose-900/50 text-rose-300 rounded hover:bg-rose-900/80 transition-colors"
                    >
                      <X size={12} />
                      驳回
                    </button>
                  </>
                )}
              </div>
            )}

            {result.status === 'confirmed' && (
              <div className="text-xs text-zinc-500 space-y-1">
                <div>
                  确认人：{result.confirmedBy} ·{' '}
                  {result.confirmedAt
                    ? new Date(result.confirmedAt).toLocaleString('zh-CN')
                    : ''}
                </div>
                {result.confirmNote && <div>备注：{result.confirmNote}</div>}
              </div>
            )}

            {result.status === 'rejected' && (
              <div className="text-xs text-zinc-500 space-y-1">
                <div>驳回原因：{result.rejectReason}</div>
                {result.correctedConclusion && (
                  <div>修正结论：{result.correctedConclusion}</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-zinc-50">古城巡逻解谜</h2>
        <p className="text-xs text-zinc-500 mt-0.5">
          自动对账 · 判断理由 · 下一步建议
        </p>
      </div>

      {auditResults.length === 0 ? (
        <div className="text-center py-16 text-zinc-600 text-sm">
          暂无对账结果，请先在时间线页添加证据数据
        </div>
      ) : (
        <>
          {pendingResults.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span className="text-xs font-medium text-zinc-400">
                  待处理（{pendingResults.length}）
                </span>
              </div>
              <div className="space-y-2">
                {pendingResults.map(renderCard)}
              </div>
            </div>
          )}

          {resolvedResults.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                <span className="text-xs font-medium text-zinc-400">
                  已处理（{resolvedResults.length}）
                </span>
              </div>
              <div className="space-y-2">
                {resolvedResults.map(renderCard)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
