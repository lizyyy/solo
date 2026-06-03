import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useStore } from '@/store/useStore'
import StatusBadge from '@/components/StatusBadge'

export default function ConflictsPage() {
  const { conflicts, allConflicts, loading, resolveConflict, fetchDashboard, fetchAllConflicts } = useStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [historyExpanded, setHistoryExpanded] = useState(false)

  const pendingConflicts = conflicts.filter((c) => c.status === 'pending')
  const resolvedConflicts = allConflicts.filter((c) => c.status !== 'pending')
  const selectedConflict = pendingConflicts.find((c) => c.id === selectedId) || pendingConflicts[0] || null

  useEffect(() => {
    fetchDashboard()
    fetchAllConflicts()
  }, [fetchDashboard, fetchAllConflicts])

  useEffect(() => {
    if (!selectedId && pendingConflicts.length > 0) {
      setSelectedId(pendingConflicts[0].id)
    }
  }, [pendingConflicts, selectedId])

  const handleResolve = async (decision: 'confirm' | 'reject') => {
    if (!selectedConflict || !reason.trim()) return
    await resolveConflict(selectedConflict.id, decision, reason)
    await fetchAllConflicts()
    setReason('')
    const remaining = pendingConflicts.filter((c) => c.id !== selectedConflict.id)
    setSelectedId(remaining.length > 0 ? remaining[0].id : null)
  }

  const parseValue = (val: string) => {
    const num = parseFloat(val)
    return isNaN(num) ? '空值' : num.toFixed(2)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-xl font-bold text-slate-100">冲突处理</h2>
        <span className="text-xs text-slate-500">
          {pendingConflicts.length} 个待处理
        </span>
      </div>

      {pendingConflicts.length === 0 && resolvedConflicts.length === 0 && (
        <div className="card text-center py-12">
          <AlertTriangle size={32} className="mx-auto text-slate-500 mb-2" />
          <div className="text-sm text-slate-500">暂无冲突数据</div>
        </div>
      )}

      {pendingConflicts.length > 0 && selectedConflict && (
        <div className="card">
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle size={18} className="text-rose-400" />
            <h3 className="text-sm font-medium text-slate-200">
              冲突 #{selectedConflict.id.slice(0, 8)} — {selectedConflict.fieldName}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="bg-slate-700/30 rounded-lg p-4 border border-slate-600/50">
              <div className="text-xs text-slate-500 mb-2">问卷原始值</div>
              <div className="text-2xl font-bold text-slate-200">
                {parseValue(selectedConflict.questionnaireValue)}
              </div>
              <div className="text-xs text-slate-500 mt-1">来自问卷导入数据</div>
            </div>
            <div className="bg-slate-700/30 rounded-lg p-4 border border-amber-500/30">
              <div className="text-xs text-amber-400 mb-2">边界值说明值</div>
              <div className="text-2xl font-bold text-amber-400">
                {parseValue(selectedConflict.boundaryNoteValue)}
              </div>
              <div className="text-xs text-slate-500 mt-1">来自边界值说明文档</div>
            </div>
          </div>

          <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-3 mb-5">
            <div className="text-xs text-rose-400">
              {selectedConflict.diffDescription}
            </div>
          </div>

          <div className="mb-5">
            <label className="text-xs text-slate-400 block mb-1.5">处理原因（必填）</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请说明选择此方案的原因"
              rows={3}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => handleResolve('reject')}
              disabled={!reason.trim() || loading}
              className="btn-secondary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <XCircle size={16} /> 驳回（保留原始值）
            </button>
            <button
              onClick={() => handleResolve('confirm')}
              disabled={!reason.trim() || loading}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-4 py-2 rounded-lg shadow-sm transition-all duration-200 inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 size={16} /> 确认（采用边界值）
            </button>
          </div>
        </div>
      )}

      {pendingConflicts.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {pendingConflicts.map((c, idx) => (
            <button
              key={c.id}
              onClick={() => {
                setSelectedId(c.id)
                setReason('')
              }}
              className={`text-xs px-3 py-1.5 rounded-lg transition-all duration-200 ${
                selectedId === c.id
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-slate-700 text-slate-400 hover:text-slate-300 border border-slate-600'
              }`}
            >
              #{idx + 1} {c.fieldName}
            </button>
          ))}
        </div>
      )}

      {resolvedConflicts.length > 0 && (
        <div className="card">
          <button
            onClick={() => setHistoryExpanded(!historyExpanded)}
            className="w-full flex items-center justify-between text-sm text-slate-400 hover:text-slate-300 transition-colors"
          >
            <span>已解决的冲突 ({resolvedConflicts.length})</span>
            {historyExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {historyExpanded && (
            <div className="mt-3 space-y-2">
              {resolvedConflicts.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg bg-slate-700/30"
                >
                  <div className="flex-1 text-sm text-slate-400">
                    <span className="text-slate-300">{c.fieldName}</span>
                    {' — '}
                    {parseValue(c.questionnaireValue)} → {parseValue(c.boundaryNoteValue)}
                  </div>
                  <StatusBadge status={c.status === 'confirmed' ? 'confirmed' : 'rejected'} />
                  <span className="text-xs text-slate-600">
                    {new Date(c.createdAt).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
