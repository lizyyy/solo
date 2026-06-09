import { useState, useEffect } from 'react'
import { FileText, X, Plus, Tag, ChevronRight, AlertCircle, CheckCircle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import StatusBadge from '@/components/StatusBadge'

export default function BoundaryPage() {
  const { boundaryNotes, questionnaireRecords, loading, supplementResult, fetchBoundaryNotes, supplementFromNote } = useStore()
  const [selectedNote, setSelectedNote] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [supplementForm, setSupplementForm] = useState({ noteId: '', targetField: '', supplementValue: '', reason: '' })
  const [showResult, setShowResult] = useState<{ conflictDetected: boolean; conflictId?: string } | null>(null)
  const [lastSupplementedNoteId, setLastSupplementedNoteId] = useState<string | null>(null)

  useEffect(() => {
    fetchBoundaryNotes()
  }, [fetchBoundaryNotes])

  const activeNote = boundaryNotes.find((n) => n.id === selectedNote)

  useEffect(() => {
    if (supplementResult) {
      setShowResult(supplementResult)
      const timer = setTimeout(() => setShowResult(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [supplementResult])

  const getRelatedRecords = (noteId: string, relatedFields: string[]) => {
    return questionnaireRecords.filter((r) => {
      if (r.boundaryNoteId === noteId) return true
      return relatedFields.includes(r.targetName)
    })
  }

  const handleSupplement = async () => {
    if (!supplementForm.noteId || !supplementForm.targetField || !supplementForm.supplementValue || !supplementForm.reason) return
    const result = await supplementFromNote(
      supplementForm.noteId,
      supplementForm.targetField,
      Number(supplementForm.supplementValue),
      supplementForm.reason
    )
    if (result) {
      setLastSupplementedNoteId(supplementForm.noteId)
      setSelectedNote(supplementForm.noteId)
      setShowModal(false)
      setSupplementForm({ noteId: '', targetField: '', supplementValue: '', reason: '' })
    }
  }

  const openSupplementModal = (noteId: string, targetField?: string) => {
    setSupplementForm({
      noteId,
      targetField: targetField || '',
      supplementValue: '',
      reason: '',
    })
    setShowModal(true)
  }

  const relatedRecords = activeNote ? getRelatedRecords(activeNote.id, activeNote.relatedFields) : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-bold text-slate-100">边界值说明</h2>
        <button onClick={() => openSupplementModal(boundaryNotes[0]?.id || '')} className="btn-primary text-sm">
          <Plus size={16} /> 补录数据
        </button>
      </div>

      {showResult && (
        <div className={`rounded-xl p-4 flex items-start gap-3 ${
          showResult.conflictDetected
            ? 'bg-rose-500/10 border border-rose-500/30'
            : 'bg-emerald-500/10 border border-emerald-500/30'
        }`}>
          {showResult.conflictDetected ? (
            <AlertCircle size={20} className="text-rose-400 flex-shrink-0 mt-0.5" />
          ) : (
            <CheckCircle size={20} className="text-emerald-400 flex-shrink-0 mt-0.5" />
          )}
          <div>
            <div className={`text-sm font-medium ${showResult.conflictDetected ? 'text-rose-400' : 'text-emerald-400'}`}>
              {showResult.conflictDetected ? '检测到冲突' : '补录成功'}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {showResult.conflictDetected
                ? `补录值与现有数据存在差异，已创建冲突记录 #${showResult.conflictId?.slice(0, 8)}，请前往冲突处理页面处理。`
                : '数据补录成功，无冲突产生。'}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-3">
          {boundaryNotes.length === 0 ? (
            <div className="card text-center text-sm text-slate-500 py-12">
              暂无边界值说明数据
            </div>
          ) : (
            boundaryNotes.map((note) => (
              <div
                key={note.id}
                onClick={() => setSelectedNote(note.id)}
                className={`card-hover cursor-pointer ${
                  selectedNote === note.id ? 'border-amber-500/50' : ''
                } ${
                  lastSupplementedNoteId === note.id ? 'ring-2 ring-amber-400/50' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium text-slate-200 text-sm">{note.title}</h3>
                  <ChevronRight size={16} className="text-slate-500" />
                </div>
                <p className="text-xs text-slate-400 line-clamp-2 mb-3">{note.content}</p>
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <Tag size={12} /> {note.relatedFields.length} 个相关字段
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-700 text-slate-400">
                    {note.methodology}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="lg:col-span-1">
          {activeNote ? (
            <div className="card sticky top-0">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-slate-200">{activeNote.title}</h3>
                <button
                  onClick={() => setSelectedNote(null)}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="text-sm text-slate-400 leading-relaxed mb-4 whitespace-pre-wrap">
                {activeNote.content}
              </div>
              <div className="border-t border-slate-700/50 pt-3">
                <div className="text-xs text-slate-500 mb-2">相关字段</div>
                <div className="flex flex-wrap gap-1.5">
                  {activeNote.relatedFields.map((field) => (
                    <span
                      key={field}
                      className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    >
                      {field}
                    </span>
                  ))}
                </div>
              </div>
              <div className="border-t border-slate-700/50 pt-3 mt-3">
                <div className="text-xs text-slate-500 mb-1">方法论</div>
                <div className="text-sm text-slate-300">{activeNote.methodology}</div>
              </div>
              <div className="border-t border-slate-700/50 pt-3 mt-3">
                <div className="text-xs text-slate-500 mb-1">生效日期</div>
                <div className="text-sm text-slate-300">{new Date(activeNote.effectiveDate).toLocaleDateString('zh-CN')}</div>
              </div>
              <div className="border-t border-slate-700/50 pt-3 mt-3">
                <div className="text-xs text-slate-500 mb-2">关联记录 ({relatedRecords.length})</div>
                {relatedRecords.length === 0 ? (
                  <div className="text-xs text-slate-500">暂无关联记录</div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {relatedRecords.map((record) => {
                      const isCurrentNoteSource = record.boundaryNoteId === activeNote.id
                      const showAmberBg = record.source === 'boundary_note' || record.recordType === 'supplemented'
                      return (
                        <div
                          key={record.id}
                          className={`rounded-lg border border-slate-600/50 p-2 text-xs space-y-1 ${
                            showAmberBg ? 'bg-amber-500/10 border-amber-500/20' : 'bg-slate-700/30'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-medium text-slate-200">{record.targetName}</div>
                            {isCurrentNoteSource && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 flex-shrink-0 whitespace-nowrap">
                                本说明补录来源
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-[11px]">
                            <div>
                              <span className="text-slate-500">权重：</span>
                              <span className="text-slate-300">{record.weight.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">得分：</span>
                              <span className="text-slate-300">{record.score.toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-1 text-[11px]">
                            <div>
                              <span className="text-slate-500">状态：</span>
                              <StatusBadge status={record.status} />
                            </div>
                            <div>
                              <span className="text-slate-500">来源：</span>
                              <StatusBadge type="source" source={record.source} />
                            </div>
                          </div>
                          {record.boundaryNoteId && (
                            <div className="text-[11px]">
                              <span className="text-slate-500">关联说明：</span>
                              <span className="text-amber-400">#{record.boundaryNoteId.slice(-8)}</span>
                            </div>
                          )}
                          {record.originalStatement && (
                            <div className="text-[11px] text-amber-400 bg-amber-500/10 rounded px-1.5 py-1 border border-amber-500/20">
                              原始说法：{record.originalStatement}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
              <button
                onClick={() => openSupplementModal(activeNote.id, activeNote.relatedFields[0])}
                className="btn-primary text-sm mt-4 w-full justify-center"
              >
                <Plus size={14} /> 补录此字段
              </button>
            </div>
          ) : (
            <div className="card flex flex-col items-center justify-center py-12 text-slate-500">
              <FileText size={32} className="mb-2 opacity-40" />
              <span className="text-sm">选择说明卡片查看详情</span>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-md p-6 shadow-xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-serif text-lg font-bold text-slate-100">补录数据</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">边界值说明ID</label>
                <input
                  type="text"
                  value={supplementForm.noteId}
                  readOnly
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-400"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5">目标字段</label>
                <select
                  value={supplementForm.targetField}
                  onChange={(e) => setSupplementForm((prev) => ({ ...prev, targetField: e.target.value }))}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="">选择字段</option>
                  {(activeNote?.relatedFields || boundaryNotes.find(n => n.id === supplementForm.noteId)?.relatedFields || []).map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5">补录值</label>
                <input
                  type="number"
                  value={supplementForm.supplementValue}
                  onChange={(e) => setSupplementForm((prev) => ({ ...prev, supplementValue: e.target.value }))}
                  placeholder="输入补录数值"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5">补录原因</label>
                <textarea
                  value={supplementForm.reason}
                  onChange={(e) => setSupplementForm((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="请说明补录原因"
                  rows={3}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">
                取消
              </button>
              <button
                onClick={handleSupplement}
                disabled={!supplementForm.noteId || !supplementForm.targetField || !supplementForm.supplementValue || !supplementForm.reason || loading}
                className="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '提交中...' : '确认补录'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
