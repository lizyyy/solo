import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useProjectStore } from '@/store'
import { updateReview, addNote, fetchDiff, resolveConflict, fetchHistory } from '@/api'
import { parseJsonField } from '@/lib/utils'

const statusConfig: Record<string, { label: string; cls: string }> = {
  pending: { label: '待处理', cls: 'bg-slate-100 text-slate-600' },
  passed: { label: '已通过', cls: 'bg-emerald-100 text-emerald-600' },
  failed: { label: '未通过', cls: 'bg-rose-100 text-rose-600' },
  needs_field_visit: { label: '需现场复看', cls: 'bg-amber-100 text-amber-600' },
  conflict: { label: '待裁决', cls: 'bg-red-100 text-red-600 animate-pulse' },
}

const sourceLabels: Record<string, string> = {
  sunlight: '实测数据',
  ledger: '审批台账',
}

interface Props {
  review: any
  projectId: string
  onUpdate: () => void
}

export default function ReviewDetail({ review, projectId, onUpdate }: Props) {
  const { operator } = useProjectStore()
  const [expanded, setExpanded] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [history, setHistory] = useState<any[]>([])
  const [diff, setDiff] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const status = statusConfig[review.status] || statusConfig.pending

  async function handleStatusChange(newStatus: string) {
    if (!operator) return
    setSubmitting(true)
    try {
      await updateReview(projectId, review.id, newStatus, newStatus === 'passed' ? '达标' : newStatus === 'failed' ? '未达标' : null, `状态变更为${statusConfig[newStatus]?.label || newStatus}`, operator)
      onUpdate()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResolve(resolution: string) {
    if (!operator) return
    setSubmitting(true)
    try {
      await resolveConflict(projectId, review.id, resolution, operator)
      onUpdate()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleAddNote() {
    if (!noteText.trim() || !operator) return
    setSubmitting(true)
    try {
      await addNote(projectId, review.id, noteText.trim(), operator)
      setNoteText('')
      onUpdate()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLoadHistory() {
    try {
      const data = await fetchHistory(projectId, review.id)
      setHistory(data)
    } catch {
      // ignore
    }
  }

  async function handleLoadDiff() {
    try {
      const data = await fetchDiff(projectId, review.id)
      setDiff(data.diff)
    } catch {
      // ignore
    }
  }

  return (
    <>
      <tr className="border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <td className="px-4 py-3 text-slate-700">{review.location_name}</td>
        <td className="px-4 py-3 text-slate-700">{review.address}</td>
        <td className="px-4 py-3 text-slate-700">{review.sunlight_hours ?? '—'}</td>
        <td className="px-4 py-3 text-slate-700">{sourceLabels[review.source] || review.source}</td>
        <td className="px-4 py-3 text-slate-700">{review.period}</td>
        <td className="px-4 py-3">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.cls}`}>
            {status.label}
          </span>
        </td>
        <td className="px-4 py-3 text-slate-500 text-xs max-w-[120px] truncate">
          {review.raw_remark || '—'}
        </td>
        <td className="px-4 py-3">
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={8} className="bg-slate-50 px-6 py-5">
            <div className="space-y-4">
              {review.raw_remark && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">原始备注</p>
                  <div className="bg-white rounded-md border border-slate-200 px-4 py-3 font-mono text-sm text-slate-600 whitespace-pre-wrap">
                    {review.raw_remark}
                  </div>
                </div>
              )}

              {review.status === 'conflict' && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">冲突裁决</p>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="bg-white rounded-lg border border-slate-200 p-3">
                      <p className="text-xs text-slate-400 mb-1">台账证据</p>
                      <p className="text-sm text-slate-700">{review.conflict_ledger_evidence || '—'}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-slate-200 p-3">
                      <p className="text-xs text-slate-400 mb-1">实测证据</p>
                      <p className="text-sm text-slate-700">{review.conflict_import_evidence || '—'}</p>
                    </div>
                    <div className="bg-white rounded-lg border border-slate-200 p-3">
                      <p className="text-xs text-slate-400 mb-1">建议动作</p>
                      <p className="text-sm text-slate-700">{review.conflict_suggestion || '—'}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleResolve('accept_ledger')} disabled={submitting} className="px-3 py-1.5 bg-teal-700 text-white text-xs rounded-lg hover:bg-teal-800 disabled:opacity-50">采信台账</button>
                    <button onClick={() => handleResolve('accept_import')} disabled={submitting} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 disabled:opacity-50">采信实测</button>
                    <button onClick={() => handleResolve('needs_field_visit')} disabled={submitting} className="px-3 py-1.5 bg-amber-600 text-white text-xs rounded-lg hover:bg-amber-700 disabled:opacity-50">需现场复看</button>
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">状态操作</p>
                <div className="flex gap-2">
                  <button onClick={() => handleStatusChange('passed')} disabled={submitting} className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-50">通过</button>
                  <button onClick={() => handleStatusChange('failed')} disabled={submitting} className="px-3 py-1.5 bg-rose-600 text-white text-xs rounded-lg hover:bg-rose-700 disabled:opacity-50">不通过</button>
                  <button onClick={() => handleStatusChange('pending')} disabled={submitting} className="px-3 py-1.5 bg-slate-500 text-white text-xs rounded-lg hover:bg-slate-600 disabled:opacity-50">待定</button>
                  <button onClick={() => handleStatusChange('needs_field_visit')} disabled={submitting} className="px-3 py-1.5 bg-amber-600 text-white text-xs rounded-lg hover:bg-amber-700 disabled:opacity-50">需现场复看</button>
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">补录备注</p>
                <div className="flex gap-2">
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={2}
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-700/30"
                    placeholder="输入备注内容..."
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={submitting || !noteText.trim()}
                    className="px-4 py-2 bg-teal-700 text-white text-xs rounded-lg hover:bg-teal-800 disabled:opacity-50 self-end"
                  >
                    补录备注
                  </button>
                </div>
              </div>

              <div>
                <div className="flex gap-2 mb-2">
                  <button onClick={handleLoadHistory} className="text-xs text-teal-700 hover:underline">查看历史</button>
                  <button onClick={handleLoadDiff} className="text-xs text-teal-700 hover:underline">查看差异</button>
                </div>
                {history.length > 0 && (
                  <div className="bg-white rounded-md border border-slate-200 p-3 space-y-2">
                    {history.map((h) => (
                      <div key={h.id} className="text-xs text-slate-600">
                        <span className="font-medium">{statusConfig[h.old_status]?.label || h.old_status}</span>
                        {' → '}
                        <span className="font-medium">{statusConfig[h.new_status]?.label || h.new_status}</span>
                        <span className="text-slate-400 ml-2">{h.reason}</span>
                        <span className="text-slate-400 ml-2">— {h.author}</span>
                        <span className="text-slate-300 ml-2">{h.created_at}</span>
                      </div>
                    ))}
                  </div>
                )}
                {diff && (
                  <div className="bg-white rounded-md border border-slate-200 p-3 font-mono text-xs whitespace-pre-wrap">
                    {diff.split('\n').map((line, i) => (
                      <div
                        key={i}
                        className={
                          line.startsWith('+')
                            ? 'text-emerald-600 bg-emerald-50'
                            : line.startsWith('-')
                              ? 'text-rose-600 bg-rose-50'
                              : 'text-slate-600'
                        }
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
