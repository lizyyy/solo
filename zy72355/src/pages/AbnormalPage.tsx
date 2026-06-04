import { useState, useEffect } from 'react'
import { AlertTriangle, CheckCircle, XCircle, RotateCcw, History, Filter } from 'lucide-react'
import { useAssessmentStore, type AssessmentItem } from '@/stores/assessmentStore'
import StatusBadge from '@/components/StatusBadge'
import { Link } from 'react-router-dom'

const filters = [
  { key: '全部', label: '全部' },
  { key: '待实验老师复核', label: '待复核' },
  { key: '已确认异常', label: '已确认异常' },
  { key: '归正常', label: '已归正常' },
  { key: '退回', label: '已退回' },
  { key: '已补看', label: '已补看正常' },
]

export default function AbnormalPage() {
  const { items, fetchItems, loading, reviewAssessment } = useAssessmentStore()
  const [activeFilter, setActiveFilter] = useState('全部')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewAction, setReviewAction] = useState<'confirm_abnormal' | 'mark_normal' | 'return_to_inspector' | null>(null)
  const [reviewReason, setReviewReason] = useState('')

  useEffect(() => {
    fetchItems(activeFilter)
  }, [activeFilter])

  const filteredItems = items

  const handleReview = async () => {
    if (!reviewingId || !reviewAction || !reviewReason) return
    await reviewAssessment(reviewingId, reviewAction, reviewReason)
    setReviewingId(null)
    setReviewAction(null)
    setReviewReason('')
  }

  const actionLabels: Record<string, { label: string; color: string }> = {
    confirm_abnormal: { label: '确认异常', color: 'text-red-600' },
    mark_normal: { label: '归正常', color: 'text-emerald-600' },
    return_to_inspector: { label: '退回质检员', color: 'text-purple-600' },
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-800">异常工况表</h1>
        <p className="text-sm text-zinc-500 mt-1">第 3 / 3 步：实验老师复核待判项，异常表实时更新</p>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-zinc-400" />
            <div className="flex gap-1">
              {filters.map(f => (
                <button
                  key={f.key}
                  onClick={() => setActiveFilter(f.key)}
                  className={`px-3 py-1 text-xs rounded transition-colors ${
                    activeFilter === f.key
                      ? 'bg-[#1B3A4B] text-white'
                      : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <span className="text-sm text-zinc-500">共 {filteredItems.length} 条</span>
        </div>

        <div className="max-h-[65vh] overflow-auto">
          {filteredItems.length === 0 ? (
            <div className="p-12 text-center text-zinc-400">
              <CheckCircle size={40} className="mx-auto mb-2" />
              <p className="text-sm">当前筛选下无数据</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-zinc-500 sticky top-0">
                <tr>
                  <th className="text-left px-5 py-2.5 font-normal whitespace-nowrap">行号</th>
                  <th className="text-left px-5 py-2.5 font-normal whitespace-nowrap">文件名</th>
                  <th className="text-left px-5 py-2.5 font-normal whitespace-nowrap">原始结论</th>
                  <th className="text-left px-5 py-2.5 font-normal whitespace-nowrap">方向</th>
                  <th className="text-left px-5 py-2.5 font-normal whitespace-nowrap">巡检备注</th>
                  <th className="text-left px-5 py-2.5 font-normal whitespace-nowrap">状态</th>
                  <th className="text-left px-5 py-2.5 font-normal whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <tr key={item.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                    <td className="px-5 py-3 font-mono text-zinc-700">{item.line_number}</td>
                    <td className="px-5 py-3 text-zinc-700 text-xs">{item.file_name}</td>
                    <td className="px-5 py-3 text-zinc-700">{item.raw_conclusion}</td>
                    <td className="px-5 py-3">
                      <span className={item.boundary_flag ? 'text-amber-600' : 'text-zinc-700'}>
                        {item.boundary_flag && '⚠ '}
                        {item.direction || '-'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-zinc-600 max-w-xs truncate" title={item.remark}>
                      {item.remark || '（无）'}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={item.status} boundaryFlag={item.boundary_flag} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <Link
                          to={`/history/${item.id}`}
                          target="_blank"
                          className="p-1.5 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded transition-colors"
                          title="查看变更历史"
                        >
                          <History size={14} />
                        </Link>
                        {item.status === '待实验老师复核' && (
                          <>
                            <button
                              onClick={() => { setReviewingId(item.id); setReviewAction('confirm_abnormal'); setReviewReason('') }}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="确认异常"
                            >
                              <XCircle size={14} />
                            </button>
                            <button
                              onClick={() => { setReviewingId(item.id); setReviewAction('mark_normal'); setReviewReason('') }}
                              className="p-1.5 text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                              title="归正常"
                            >
                              <CheckCircle size={14} />
                            </button>
                            <button
                              onClick={() => { setReviewingId(item.id); setReviewAction('return_to_inspector'); setReviewReason('') }}
                              className="p-1.5 text-purple-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                              title="退回质检员"
                            >
                              <RotateCcw size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {reviewingId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setReviewingId(null)}>
          <div className="bg-white rounded-lg p-6 w-96 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-zinc-800 mb-4">实验老师复核</h3>
            <div className="mb-4">
              <p className="text-sm text-zinc-500 mb-1">复核操作</p>
              <p className={`font-medium ${actionLabels[reviewAction!]?.color}`}>
                {actionLabels[reviewAction!]?.label}
              </p>
            </div>
            <div className="mb-5">
              <label className="block text-sm text-zinc-500 mb-1">复核理由</label>
              <textarea
                value={reviewReason}
                onChange={e => setReviewReason(e.target.value)}
                className="w-full p-3 text-sm border border-zinc-200 rounded focus:outline-none focus:border-[#1B3A4B] resize-none"
                rows={3}
                placeholder="请输入复核理由（将记入变更历史）"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setReviewingId(null); setReviewAction(null) }}
                className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded"
              >
                取消
              </button>
              <button
                onClick={handleReview}
                disabled={!reviewReason.trim() || loading}
                className="px-4 py-2 text-sm bg-[#1B3A4B] text-white rounded hover:bg-[#152d3a] disabled:opacity-50"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
