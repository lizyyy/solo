import { useStore } from '@/store/useStore'
import {
  TrendingUp,
  Shield,
  FilePlus,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  History,
} from 'lucide-react'
import type { RiskOpinion } from '@/types'
import { useState } from 'react'

export default function Summary() {
  const records = useStore((s) => s.records)
  const conflicts = useStore((s) => s.conflicts)
  const summaries = useStore((s) => s.summaries)
  const riskReviews = useStore((s) => s.riskReviews)
  const updateSummary = useStore((s) => s.updateSummary)
  const submitRiskReview = useStore((s) => s.submitRiskReview)

  const [reviewingRecordId, setReviewingRecordId] = useState<string | null>(null)
  const [reviewOpinion, setReviewOpinion] = useState<RiskOpinion>('通过')
  const [reviewComment, setReviewComment] = useState('')

  const pendingRisk = records.filter((r) => r.status === '待风控复核')
  const totalAmount = records.reduce((s, r) => s + r.amount, 0)
  const normalCount = records.filter((r) => r.status === '正常').length
  const reversedCount = records.filter(
    (r) => r.status === '已冲正' || r.status === '待风控复核'
  ).length
  const supplementCount = records.filter((r) => r.status === '尾差补录').length
  const unresolvedConflicts = conflicts.filter((c) => c.resolution === '待裁决').length
  const resolvedConflicts = conflicts.filter((c) => c.resolution !== '待裁决').length

  const handleSubmitReview = () => {
    if (!reviewingRecordId || !reviewComment) return
    submitRiskReview(reviewingRecordId, '风控同事', reviewOpinion, reviewComment)
    setReviewingRecordId(null)
    setReviewComment('')
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h2
            className="text-2xl font-bold text-[#1a365d] mb-1"
            style={{ fontFamily: '"Noto Serif SC", serif' }}
          >
            负责人摘要
          </h2>
          <p className="text-sm text-slate-400">给负责人看的汇总摘要及历史记录</p>
        </div>
        <button
          onClick={updateSummary}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a365d] text-white text-sm font-medium rounded-lg hover:bg-[#1e3f7a] transition-colors"
        >
          <RefreshCw size={14} />
          更新摘要
        </button>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-8">
        <div className="bg-gradient-to-br from-[#1a365d] to-[#1e3f7a] rounded-xl p-5 text-white shadow-lg">
          <p className="text-xs text-blue-200 mb-1">汇总金额</p>
          <p className="text-xl font-bold font-mono">¥{totalAmount.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={14} className="text-emerald-500" />
            <p className="text-xs text-slate-400">正常</p>
          </div>
          <p className="text-xl font-bold text-slate-800">{normalCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-amber-500" />
            <p className="text-xs text-slate-400">冲正/待复核</p>
          </div>
          <p className="text-xl font-bold text-slate-800">{reversedCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <FilePlus size={14} className="text-indigo-500" />
            <p className="text-xs text-slate-400">尾差补录</p>
          </div>
          <p className="text-xl font-bold text-slate-800">{supplementCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Shield size={14} className="text-red-500" />
            <p className="text-xs text-slate-400">冲突</p>
          </div>
          <p className="text-xl font-bold text-slate-800">
            {resolvedConflicts}/{conflicts.length}
            <span className="text-xs text-slate-400 ml-1">已解决</span>
          </p>
        </div>
      </div>

      {pendingRisk.length > 0 && (
        <div className="mb-8 bg-white rounded-xl border-2 border-red-200 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={18} className="text-red-500" />
            <h3 className="text-sm font-semibold text-red-800">风控复核区</h3>
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
              {pendingRisk.length} 条待复核
            </span>
          </div>
          <div className="space-y-3">
            {pendingRisk.map((r) => (
              <div key={r.id} className="bg-red-50/50 rounded-lg border border-red-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-slate-800">{r.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      金额 ¥{r.amount.toLocaleString()} · 备注：{r.remark}
                    </p>
                  </div>
                  {reviewingRecordId !== r.id && (
                    <button
                      onClick={() => setReviewingRecordId(r.id)}
                      className="text-xs font-medium px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      开始复核
                    </button>
                  )}
                </div>
                {reviewingRecordId === r.id && (
                  <div className="mt-3 pt-3 border-t border-red-200 space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-medium text-slate-500">意见：</label>
                      <select
                        value={reviewOpinion}
                        onChange={(e) => setReviewOpinion(e.target.value as RiskOpinion)}
                        className="px-2 py-1 text-sm border border-slate-200 rounded focus:outline-none focus:ring-2 focus:ring-red-300"
                      >
                        <option value="通过">通过</option>
                        <option value="驳回">驳回</option>
                        <option value="待补充">待补充</option>
                      </select>
                    </div>
                    <div>
                      <input
                        type="text"
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder="请输入复核意见"
                        className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-300"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSubmitReview}
                        disabled={!reviewComment}
                        className="text-xs font-medium px-4 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-40"
                      >
                        提交复核
                      </button>
                      <button
                        onClick={() => {
                          setReviewingRecordId(null)
                          setReviewComment('')
                        }}
                        className="text-xs font-medium px-4 py-1.5 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
                {riskReviews
                  .filter((rv) => rv.recordId === r.id)
                  .map((rv) => (
                    <div
                      key={rv.id}
                      className="mt-2 pt-2 border-t border-red-100 text-xs text-slate-600"
                    >
                      风控意见：{rv.opinion} — {rv.comment}（{rv.reviewer}，{new Date(rv.reviewedAt).toLocaleString('zh-CN')}）
                    </div>
                  ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {unresolvedConflicts > 0 && (
        <div className="mb-8 bg-amber-50 rounded-xl border border-amber-200 p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <p className="text-sm text-amber-800 font-medium">
              尚有 {unresolvedConflicts} 条冲突未裁决，摘要可能不完整
            </p>
          </div>
        </div>
      )}

      {conflicts.filter((c) => c.resolution !== '待裁决').length > 0 && (
        <div className="mb-8 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">冲突处理结论</h3>
          <div className="space-y-2">
            {conflicts
              .filter((c) => c.resolution !== '待裁决')
              .map((c) => (
                <div key={c.id} className="flex items-start gap-3 text-sm">
                  <span
                    className={`inline-block w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${
                      c.resolution === '已确认'
                        ? 'bg-emerald-100 text-emerald-600'
                        : 'bg-amber-100 text-amber-600'
                    }`}
                  >
                    {c.resolution === '已确认' ? (
                      <CheckCircle size={12} />
                    ) : (
                      <AlertTriangle size={12} />
                    )}
                  </span>
                  <div>
                    <p className="text-slate-700">
                      {c.conflictField}冲突：{c.resolution === '已确认' ? '采纳尾差调整条' : '保留顺延说明'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      裁决人：{c.resolvedBy} · 理由：{c.resolveReason}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <History size={16} className="text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700">历史记录</h3>
        </div>
        {summaries.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">
            点击「更新摘要」生成历史快照
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 px-3 text-xs font-medium text-slate-400">时间</th>
                  <th className="text-right py-2 px-3 text-xs font-medium text-slate-400">汇总金额</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-slate-400">正常</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-slate-400">冲正</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-slate-400">补录</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-slate-400">待复核</th>
                  <th className="text-center py-2 px-3 text-xs font-medium text-slate-400">冲突</th>
                </tr>
              </thead>
              <tbody>
                {[...summaries].reverse().map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 text-slate-600">
                      {new Date(s.createdAt).toLocaleString('zh-CN')}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-800 font-medium">
                      ¥{s.totalAmount.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-center text-emerald-600">{s.normalCount}</td>
                    <td className="py-2.5 px-3 text-center text-amber-600">{s.reversedCount}</td>
                    <td className="py-2.5 px-3 text-center text-indigo-600">{s.supplementCount}</td>
                    <td className="py-2.5 px-3 text-center text-red-600">{s.riskReviewCount}</td>
                    <td className="py-2.5 px-3 text-center text-slate-600">
                      {s.resolvedConflictCount}/{s.conflictCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
