import { useEffect, useState } from 'react'
import { Download, RefreshCw, AlertTriangle, ChevronDown, ChevronRight, X, History, ArrowRight } from 'lucide-react'
import { useAppStore } from '@/store'
import type { DemoResult } from '@/store'
import HistoryPanel from '@/components/HistoryPanel'

export default function Demo() {
  const { demoResults, fetchDemoResults, recalculateDemo, exportDemo, reviewDenominatorZero, loading } = useAppStore()
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [reviewingItem, setReviewingItem] = useState<DemoResult | null>(null)
  const [reviewDecision, setReviewDecision] = useState<'confirm_anomaly' | 'confirm_corrected'>('confirm_anomaly')
  const [reviewer, setReviewer] = useState('')
  const [reviewReason, setReviewReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [recalculating, setRecalculating] = useState(false)
  const [historyParamItemId, setHistoryParamItemId] = useState<string | null>(null)

  useEffect(() => {
    fetchDemoResults()
  }, [fetchDemoResults])

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleExport = async () => {
    try {
      const result = await exportDemo()
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `demo-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      console.error('Export failed')
    }
  }

  const handleRecalculate = async () => {
    setRecalculating(true)
    try {
      await recalculateDemo('demo_update')
    } finally {
      setRecalculating(false)
    }
  }

  const handleReviewSubmit = async () => {
    if (!reviewingItem || !reviewer.trim() || !reviewReason.trim()) return
    setSubmitting(true)
    try {
      await reviewDenominatorZero(reviewingItem.paramItemId, reviewDecision, reviewer, reviewReason)
      setReviewingItem(null)
      setReviewer('')
      setReviewReason('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">课堂演示</h2>
        <div className="flex gap-3">
          <button
            onClick={handleRecalculate}
            disabled={recalculating || loading}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-slate-200 font-medium rounded text-sm transition-colors flex items-center gap-2"
          >
            <RefreshCw size={14} className={recalculating ? 'animate-spin' : ''} />
            重新计算
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded text-sm transition-colors flex items-center gap-2"
          >
            <Download size={14} />
            导出
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-10">加载中...</div>
      ) : demoResults.length === 0 ? (
        <div className="text-center text-slate-500 py-10">暂无演示数据</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-2 px-3 text-slate-400 font-medium w-8"></th>
              <th className="text-left py-2 px-3 text-slate-400 font-medium">参数名</th>
              <th className="text-left py-2 px-3 text-slate-400 font-medium">值/标签</th>
              <th className="text-left py-2 px-3 text-slate-400 font-medium">版本</th>
              <th className="text-left py-2 px-3 text-slate-400 font-medium">复核状态</th>
              <th className="text-left py-2 px-3 text-slate-400 font-medium w-16">操作</th>
            </tr>
          </thead>
          <tbody>
            {demoResults.map((item, idx) => {
              const isExpanded = expandedRows.has(item.id)
              const showValueDiff = item.previousValue && item.previousValue !== item.value
              return (
                <>
                  <tr
                    key={item.id}
                    className={`border-b border-slate-700/50 cursor-pointer ${
                      item.isDenominatorZero ? 'bg-amber-500/10' : idx % 2 === 1 ? 'bg-slate-800/30' : ''
                    } hover:bg-slate-700/30 transition-colors`}
                    onClick={() => toggleRow(item.id)}
                  >
                    <td className="py-2 px-3">
                      {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                    </td>
                    <td className="py-2 px-3 font-mono">
                      {item.isDenominatorZero && <AlertTriangle size={14} className="inline mr-1 text-amber-400" />}
                      {item.paramName}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex flex-col">
                        {item.isDenominatorZero ? (
                          <span className="text-amber-400">{item.displayLabel}</span>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            {showValueDiff && (
                              <>
                                <span className="text-slate-500 line-through font-mono">{item.previousValue}</span>
                                <ArrowRight size={12} className="text-slate-600" />
                              </>
                            )}
                            <span className={`font-mono ${showValueDiff ? 'text-amber-400' : ''}`}>{item.value}</span>
                          </div>
                        )}
                        {item.nextAction && (
                          <div className="text-xs text-sky-400 mt-1 flex items-center gap-1">
                            <ArrowRight size={10} />
                            {item.nextAction}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-slate-400">{item.paramVersion}</td>
                    <td className="py-2 px-3">
                      {item.reviewStatus === 'pending_review' ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); setReviewingItem(item); setReviewDecision('confirm_anomaly'); setReviewer(''); setReviewReason('') }}
                          className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded hover:bg-amber-500/30 transition-colors"
                        >
                          待复核
                        </button>
                      ) : item.reviewStatus === 'reviewed' ? (
                        <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">已复核</span>
                      ) : (
                        <span className="text-xs text-slate-500">正常</span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); setHistoryParamItemId(item.paramItemId) }}
                        className="p-1.5 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-700/50 transition-colors"
                        title="查看历史"
                      >
                        <History size={14} />
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="border-b border-slate-700/50 bg-slate-900/50">
                      <td colSpan={6} className="py-3 px-6">
                        <div className="space-y-3">
                          <div>
                            <div className="text-xs text-slate-500 mb-1">参数依据</div>
                            <div className="text-sm text-slate-300 whitespace-pre-wrap bg-slate-800/50 rounded p-2">
                              <div className="text-slate-500 mb-1 text-xs">v{item.paramVersion}</div>
                              {item.rationale || '无'}
                            </div>
                          </div>
                          {item.adjudicationNote && (
                            <div>
                              <div className="text-xs text-amber-500 mb-1">裁决理由</div>
                              <div className="text-sm text-slate-300 whitespace-pre-wrap bg-amber-500/5 rounded p-2 border border-amber-500/20">{item.adjudicationNote}</div>
                            </div>
                          )}
                          {item.reviewNote && (
                            <div>
                              <div className="text-xs text-sky-500 mb-1">复核备注</div>
                              <div className="text-sm text-slate-300 whitespace-pre-wrap bg-sky-500/5 rounded p-2 border border-sky-500/20">{item.reviewNote}</div>
                            </div>
                          )}
                          {item.counterexampleNoteRaw && (
                            <div>
                              <div className="text-xs text-red-400 mb-1">反例依据</div>
                              <div className="text-sm font-mono text-slate-300 whitespace-pre-wrap bg-red-500/5 rounded p-2 border border-red-500/20">{item.counterexampleNoteRaw}</div>
                            </div>
                          )}
                          {item.lastActor && (
                            <div className="text-xs text-slate-500">
                              最后操作人: <span className="text-slate-400">{item.lastActor}</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              )
            })}
          </tbody>
        </table>
      )}

      {reviewingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setReviewingItem(null)} />
          <div className="relative bg-slate-800 border border-slate-700 rounded-lg w-[480px] p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">分母为零复核</h3>
              <button onClick={() => setReviewingItem(null)} className="text-slate-400 hover:text-slate-200">
                <X size={20} />
              </button>
            </div>

            <div className="bg-slate-900 rounded-lg p-4 mb-5">
              <div className="text-sm mb-1">
                <span className="text-slate-400">参数:</span>
                <span className="font-mono ml-2">{reviewingItem.paramName}</span>
              </div>
              <div className="text-sm">
                <span className="text-slate-400">显示标签:</span>
                <span className="font-mono ml-2 text-amber-400">{reviewingItem.displayLabel}</span>
              </div>
            </div>

            <div className="space-y-4 mb-5">
              <div className="flex gap-3">
                <button
                  onClick={() => setReviewDecision('confirm_anomaly')}
                  className={`flex-1 py-2 px-3 rounded text-sm font-medium border transition-colors ${
                    reviewDecision === 'confirm_anomaly'
                      ? 'border-amber-400 bg-amber-400/10 text-amber-400'
                      : 'border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  确认异常（保持标记）
                </button>
                <button
                  onClick={() => setReviewDecision('confirm_corrected')}
                  className={`flex-1 py-2 px-3 rounded text-sm font-medium border transition-colors ${
                    reviewDecision === 'confirm_corrected'
                      ? 'border-emerald-400 bg-emerald-400/10 text-emerald-400'
                      : 'border-slate-600 text-slate-400 hover:border-slate-500'
                  }`}
                >
                  确认修正（取消异常）
                </button>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">复核人</label>
                <input
                  value={reviewer}
                  onChange={(e) => setReviewer(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 focus:outline-none focus:border-amber-400"
                  placeholder="输入姓名"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1">理由</label>
                <textarea
                  value={reviewReason}
                  onChange={(e) => setReviewReason(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-sm text-slate-200 focus:outline-none focus:border-amber-400 resize-none"
                  placeholder="输入理由"
                />
              </div>
            </div>

            <button
              onClick={handleReviewSubmit}
              disabled={submitting || !reviewer.trim() || !reviewReason.trim()}
              className="w-full py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-600 disabled:text-slate-400 text-black font-medium rounded text-sm transition-colors"
            >
              {submitting ? '提交中...' : '提交复核'}
            </button>
          </div>
        </div>
      )}

      {historyParamItemId && (
        <HistoryPanel
          paramItemId={historyParamItemId}
          onClose={() => setHistoryParamItemId(null)}
        />
      )}
    </div>
  )
}
