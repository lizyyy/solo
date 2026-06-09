import { useState, useEffect } from 'react'
import { ClipboardCheck, CheckCircle2, XCircle, AlertCircle, FileText } from 'lucide-react'
import { useStore } from '@/store/useStore'
import StatusBadge from '@/components/StatusBadge'

export default function ReviewPage() {
  const { reviewTasks, boundaryNotes, questionnaireRecords, loading, fetchReviewTasks, approveReviewTask, rejectReviewTask, fetchDashboard } = useStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [originalStatement, setOriginalStatement] = useState('')
  const [correctedValue, setCorrectedValue] = useState('')
  const [nextHandler, setNextHandler] = useState('')

  useEffect(() => {
    fetchReviewTasks()
    fetchDashboard()
  }, [fetchReviewTasks, fetchDashboard])

  const pendingTasks = reviewTasks.filter((t) => t.status === 'pending')
  const selectedTask = pendingTasks.find((t) => t.id === selectedId) || pendingTasks[0] || null

  useEffect(() => {
    if (!selectedId && pendingTasks.length > 0) {
      setSelectedId(pendingTasks[0].id)
    }
  }, [pendingTasks, selectedId])

  useEffect(() => {
    if (selectedTask) {
      setOriginalStatement(selectedTask.originalStatement || '')
      setCorrectedValue(selectedTask.correctedValue !== undefined ? String(selectedTask.correctedValue) : '')
      setNextHandler(selectedTask.nextHandler || '')
    } else {
      setOriginalStatement('')
      setCorrectedValue('')
      setNextHandler('')
    }
  }, [selectedTask])

  const handleApprove = async () => {
    if (!selectedTask) return
    const extra: any = {}
    if (originalStatement.trim()) extra.originalStatement = originalStatement.trim()
    if (correctedValue.trim() !== '') extra.correctedValue = Number(correctedValue)
    if (nextHandler.trim()) extra.nextHandler = nextHandler.trim()
    await approveReviewTask(selectedTask.id, note, Object.keys(extra).length > 0 ? extra : undefined)
    setNote('')
    setOriginalStatement('')
    setCorrectedValue('')
    setNextHandler('')
    const remaining = pendingTasks.filter((t) => t.id !== selectedTask.id)
    setSelectedId(remaining.length > 0 ? remaining[0].id : null)
  }

  const handleReject = async () => {
    if (!selectedTask) return
    const extra: any = {}
    if (originalStatement.trim()) extra.originalStatement = originalStatement.trim()
    if (correctedValue.trim() !== '') extra.correctedValue = Number(correctedValue)
    if (nextHandler.trim()) extra.nextHandler = nextHandler.trim()
    await rejectReviewTask(selectedTask.id, note, Object.keys(extra).length > 0 ? extra : undefined)
    setNote('')
    setOriginalStatement('')
    setCorrectedValue('')
    setNextHandler('')
    const remaining = pendingTasks.filter((t) => t.id !== selectedTask.id)
    setSelectedId(remaining.length > 0 ? remaining[0].id : null)
  }

  const parseRawValue = (raw: string) => {
    const parts = raw.split(',')
    return {
      targetName: parts[0] || '-',
      weight: parts[1] || '-',
      score: parts[2] || '-',
      denominator: parts[3] || '-',
    }
  }

  const getBoundaryNoteForTask = () => {
    if (!selectedTask) return null
    const noteId = selectedTask.boundaryNoteId
    if (noteId) {
      return boundaryNotes.find((n) => n.id === noteId) || null
    }
    const record = questionnaireRecords.find((r) => r.id === selectedTask.recordId)
    if (record?.boundaryNoteId) {
      return boundaryNotes.find((n) => n.id === record.boundaryNoteId) || null
    }
    return null
  }

  const boundaryNote = getBoundaryNoteForTask()

  const getOriginalStatementSummary = (text: string | undefined) => {
    if (!text) return '-'
    return text.length > 20 ? text.slice(0, 20) + '...' : text
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-bold text-slate-100">数据复核</h2>
        <span className="text-xs text-slate-500">
          {pendingTasks.length} 个待复核
        </span>
      </div>

      {pendingTasks.length === 0 ? (
        <div className="card text-center py-12">
          <ClipboardCheck size={32} className="mx-auto text-emerald-400 mb-2" />
          <div className="text-sm text-slate-400">暂无待复核任务</div>
          <div className="text-xs text-slate-500 mt-1">所有数据已完成复核</div>
        </div>
      ) : (
        <>
          {selectedTask && (
            <div className="card">
              <div className="flex items-center gap-2 mb-5">
                <AlertCircle size={18} className="text-amber-400" />
                <h3 className="text-sm font-medium text-slate-200">
                  复核任务 #{selectedTask.id.slice(0, 8)} — {selectedTask.targetName}
                </h3>
              </div>

              {boundaryNote && (
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-4 mb-5">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText size={14} className="text-amber-400" />
                    <span className="text-xs font-medium text-amber-400">关联边界值说明</span>
                  </div>
                  <div className="text-sm font-medium text-slate-200 mb-1">{boundaryNote.title}</div>
                  {boundaryNote.methodology && (
                    <div className="text-xs text-slate-400 mb-1">方法论：{boundaryNote.methodology}</div>
                  )}
                  {boundaryNote.content && (
                    <div className="text-xs text-slate-500 line-clamp-2">
                      {boundaryNote.content.length > 100 ? boundaryNote.content.slice(0, 100) + '...' : boundaryNote.content}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
                <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50">
                  <div className="text-xs text-slate-500 mb-2">指标名称</div>
                  <div className="text-lg font-bold text-slate-200">{selectedTask.targetName}</div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50">
                  <div className="text-xs text-slate-500 mb-2">权重</div>
                  <div className="text-lg font-bold text-slate-200">{parseRawValue(selectedTask.rawValue).weight}</div>
                </div>
                <div className="bg-rose-500/10 rounded-lg p-4 border border-rose-500/30">
                  <div className="text-xs text-rose-400 mb-2">得分</div>
                  <div className="text-lg font-bold text-rose-400">{parseRawValue(selectedTask.rawValue).score || '空值'}</div>
                </div>
                <div className="bg-rose-500/10 rounded-lg p-4 border border-rose-500/30">
                  <div className="text-xs text-rose-400 mb-2">分母</div>
                  <div className="text-lg font-bold text-rose-400">{parseRawValue(selectedTask.rawValue).denominator || '空值'}</div>
                </div>
              </div>

              <div className="flex items-center gap-3 mb-5">
                <span className="text-xs text-slate-500">记录类型：</span>
                <StatusBadge status={selectedTask.recordType} />
                <span className="text-xs text-slate-500 ml-3">复核员：</span>
                <span className="text-xs text-slate-400">{selectedTask.reviewer}</span>
              </div>

              <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 mb-5">
                <div className="text-xs text-amber-400">
                  该记录分母为0且分数为空，需要人工复核确认处理方式。
                </div>
              </div>

              <div className="space-y-4 mb-5">
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">复核意见（必填）</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="请说明复核意见"
                    rows={3}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1.5">原始说法</label>
                  <textarea
                    value={originalStatement}
                    onChange={(e) => setOriginalStatement(e.target.value)}
                    placeholder="请摘录原始说法/边界值备注原文..."
                    rows={3}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-slate-400 block mb-1.5">改后的值</label>
                    <input
                      type="number"
                      value={correctedValue}
                      onChange={(e) => setCorrectedValue(e.target.value)}
                      placeholder="如通过复核需修正分数，填入正确值"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 block mb-1.5">下一步处理人</label>
                    <input
                      type="text"
                      value={nextHandler}
                      onChange={(e) => setNextHandler(e.target.value)}
                      placeholder="后续跟进处理人"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleReject}
                  disabled={!note.trim() || loading}
                  className="btn-secondary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircle size={16} /> 驳回
                </button>
                <button
                  onClick={handleApprove}
                  disabled={!note.trim() || loading}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm transition-all duration-200 inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 size={16} /> 通过
                </button>
              </div>
            </div>
          )}

          {pendingTasks.length > 1 && (
            <div className="card">
              <div className="text-xs text-slate-400 mb-3">复核队列</div>
              <div className="flex gap-2 flex-wrap">
                {pendingTasks.map((t, idx) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedId(t.id)
                      setNote('')
                    }}
                    className={`text-xs px-3 py-1.5 rounded-lg transition-all duration-200 ${
                      selectedId === t.id
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-slate-700 text-slate-400 hover:text-slate-300 border border-slate-600'
                    }`}
                  >
                    #{idx + 1} {t.targetName}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="card p-0 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-700/50">
              <span className="text-sm font-medium text-slate-300">待复核列表</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="table-header">
                    <th className="px-4 py-3 text-left">指标名称</th>
                    <th className="px-4 py-3 text-right">权重</th>
                    <th className="px-4 py-3 text-right">得分</th>
                    <th className="px-4 py-3 text-right">分母</th>
                    <th className="px-4 py-3 text-left">类型</th>
                    <th className="px-4 py-3 text-left">原始说法</th>
                    <th className="px-4 py-3 text-left">下一步处理人</th>
                    <th className="px-4 py-3 text-left">状态</th>
                    <th className="px-4 py-3 text-left">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingTasks.map((task, idx) => {
                    const parsed = parseRawValue(task.rawValue)
                    return (
                      <tr
                        key={task.id}
                        className={`table-row border-l-2 border-l-amber-500 ${idx % 2 === 0 ? 'bg-slate-800/30' : ''}`}
                      >
                        <td className="px-4 py-3 text-slate-300 font-medium">{task.targetName}</td>
                        <td className="px-4 py-3 text-right text-slate-400">{parsed.weight}</td>
                        <td className="px-4 py-3 text-right text-rose-400">{parsed.score || '-'}</td>
                        <td className="px-4 py-3 text-right text-rose-400">{parsed.denominator || '-'}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={task.recordType} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 max-w-[160px] truncate">
                          {getOriginalStatementSummary(task.originalStatement)}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-400">
                          {task.nextHandler || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status="review" />
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => {
                              setSelectedId(task.id)
                              setNote('')
                            }}
                            className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                          >
                            处理
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
