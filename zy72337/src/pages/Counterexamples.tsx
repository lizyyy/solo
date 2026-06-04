import { useEffect, useState } from 'react'
import { X, AlertTriangle } from 'lucide-react'
import { useAppStore } from '@/store'
import type { Counterexample, Conflict } from '@/store'

export default function Counterexamples() {
  const { counterexamples, conflicts, fetchCounterexamples, fetchConflicts, adjudicateConflict } = useAppStore()
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null)
  const [adjudicator, setAdjudicator] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchCounterexamples()
    fetchConflicts()
  }, [fetchCounterexamples, fetchConflicts])

  const getConflictForCounterexample = (ceId: string): Conflict | undefined => {
    return conflicts.find((c) => c.counterexampleId === ceId && c.status === 'pending')
  }

  const handleOpenDrawer = (ce: Counterexample) => {
    const conflict = getConflictForCounterexample(ce.id)
    if (conflict) {
      setSelectedConflict(conflict)
      setAdjudicator('')
      setReason('')
    }
  }

  const handleAdjudicate = async (decision: 'confirmed' | 'rejected') => {
    if (!selectedConflict || !adjudicator.trim() || !reason.trim()) return
    setSubmitting(true)
    try {
      await adjudicateConflict(selectedConflict.id, decision, reason, adjudicator)
      setSelectedConflict(null)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">手算反例</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {counterexamples.map((ce) => {
          const conflict = getConflictForCounterexample(ce.id)
          return (
            <div
              key={ce.id}
              className={`bg-slate-800 rounded-lg p-4 border-l-4 ${
                ce.hasConflict ? 'border-l-red-500' : 'border-l-slate-600'
              } ${conflict ? 'cursor-pointer hover:bg-slate-700 transition-colors' : ''}`}
              onClick={() => conflict && handleOpenDrawer(ce)}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="font-bold text-base">{ce.name}</span>
                {ce.hasConflict && (
                  <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">冲突</span>
                )}
              </div>

              <div className="font-mono text-sm text-slate-300 bg-slate-900 rounded p-3 mb-3" style={{ whiteSpace: 'pre-wrap' }}>
                {ce.noteRaw}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-slate-900 rounded p-2">
                  <div className="text-xs text-slate-400 mb-1">期望值</div>
                  <div className="font-mono text-emerald-400">{ce.expectedValue}</div>
                </div>
                <div className="bg-slate-900 rounded p-2">
                  <div className="text-xs text-slate-400 mb-1">实际值</div>
                  <div className="font-mono text-red-400">{ce.actualValue}</div>
                </div>
              </div>

              <div className="text-xs text-slate-500 mt-2">{new Date(ce.createdAt).toLocaleString('zh-CN')}</div>
            </div>
          )
        })}
      </div>

      {counterexamples.length === 0 && (
        <div className="text-center text-slate-500 py-10">暂无反例数据</div>
      )}

      {selectedConflict && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSelectedConflict(null)} />
          <div className="relative w-[400px] bg-slate-800 border-l border-slate-700 p-6 overflow-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">冲突裁定</h3>
              <button onClick={() => setSelectedConflict(null)} className="text-slate-400 hover:text-slate-200">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-slate-900 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle size={16} className="text-red-400" />
                  <span className="text-sm font-medium text-red-400">冲突证据</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="text-xs text-slate-400">参数值</div>
                    <div className="font-mono text-sm text-amber-400">{selectedConflict.paramValue}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">反例值</div>
                    <div className="font-mono text-sm text-red-400">{selectedConflict.counterexampleValue}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">反例依据</div>
                    <div className="font-mono text-sm text-slate-300 mt-1" style={{ whiteSpace: 'pre-wrap' }}>
                      {selectedConflict.counterexampleNote}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm text-slate-300 mb-1">裁定人</label>
                <input
                  value={adjudicator}
                  onChange={(e) => setAdjudicator(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 focus:outline-none focus:border-amber-400"
                  placeholder="输入姓名"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">裁定理由</label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 focus:outline-none focus:border-amber-400 resize-none"
                  placeholder="输入理由"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleAdjudicate('confirmed')}
                disabled={submitting || !adjudicator.trim() || !reason.trim()}
                className="flex-1 py-2 px-4 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-600 disabled:text-slate-400 text-black font-medium rounded text-sm transition-colors"
              >
                确认（以反例为准）
              </button>
              <button
                onClick={() => handleAdjudicate('rejected')}
                disabled={submitting || !adjudicator.trim() || !reason.trim()}
                className="flex-1 py-2 px-4 bg-slate-600 hover:bg-slate-500 disabled:bg-slate-700 disabled:text-slate-500 text-slate-200 font-medium rounded text-sm transition-colors"
              >
                驳回（保留参数）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
