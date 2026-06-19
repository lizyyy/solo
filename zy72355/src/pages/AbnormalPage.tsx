import { useState, useEffect, Fragment } from 'react'
import { AlertTriangle, CheckCircle, XCircle, RotateCcw, History, Filter, ChevronDown, ChevronUp, User, FileText, Shield } from 'lucide-react'
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
  { key: '待补看', label: '待补看' },
]

export default function AbnormalPage() {
  const { items, fetchItems, loading, reviewAssessment } = useAssessmentStore()
  const [activeFilter, setActiveFilter] = useState('全部')
  const [reviewingId, setReviewingId] = useState<string | null>(null)
  const [reviewAction, setReviewAction] = useState<'confirm_abnormal' | 'mark_normal' | 'return_to_inspector' | null>(null)
  const [reviewReason, setReviewReason] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetchItems(activeFilter)
  }, [activeFilter])

  const filteredItems = items

  const handleReview = async () => {
    if (!reviewingId || !reviewAction || !reviewReason) return
    await reviewAssessment(reviewingId, reviewAction, reviewReason)
    await fetchItems(activeFilter)
    setReviewingId(null)
    setReviewAction(null)
    setReviewReason('')
  }

  const reviewingItem = filteredItems.find(i => i.id === reviewingId)

  const actionLabels: Record<string, { label: string; color: string; nextOwner: string }> = {
    confirm_abnormal: { label: '确认异常', color: 'text-red-600', nextOwner: '归档/异常处理流程' },
    mark_normal: { label: '归正常', color: 'text-emerald-600', nextOwner: '质检员（完成）' },
    return_to_inspector: { label: '退回质检员', color: 'text-purple-600', nextOwner: '质检员（重新处理）' },
  }

  const summary = {
    total: filteredItems.length,
    pending: filteredItems.filter(i => i.status === '待实验老师复核').length,
    abnormal: filteredItems.filter(i => i.status === '已确认异常').length,
    normal: filteredItems.filter(i => i.status === '归正常').length,
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-800">异常工况表</h1>
        <p className="text-sm text-zinc-500 mt-1">第 3 / 3 步：实验老师复核待判项，所有列表/详情/摘要/历史同步同一份数据</p>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-zinc-200 p-4">
          <div className="text-xs text-zinc-500 mb-1">本筛选总数</div>
          <div className="text-2xl font-bold text-zinc-800">{summary.total}</div>
        </div>
        <div className="bg-white rounded-lg border border-amber-200 p-4">
          <div className="text-xs text-amber-600 mb-1 flex items-center gap-1">
            <Shield size={12} /> 待实验老师复核
          </div>
          <div className="text-2xl font-bold text-amber-700">{summary.pending}</div>
        </div>
        <div className="bg-white rounded-lg border border-red-200 p-4">
          <div className="text-xs text-red-600 mb-1 flex items-center gap-1">
            <XCircle size={12} /> 已确认异常
          </div>
          <div className="text-2xl font-bold text-red-700">{summary.abnormal}</div>
        </div>
        <div className="bg-white rounded-lg border border-emerald-200 p-4">
          <div className="text-xs text-emerald-600 mb-1 flex items-center gap-1">
            <CheckCircle size={12} /> 已归正常
          </div>
          <div className="text-2xl font-bold text-emerald-700">{summary.normal}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-zinc-400" />
            <div className="flex gap-1 flex-wrap">
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

        <div className="max-h-[60vh] overflow-auto">
          {filteredItems.length === 0 ? (
            <div className="p-12 text-center text-zinc-400">
              <CheckCircle size={40} className="mx-auto mb-2" />
              <p className="text-sm">当前筛选下无数据</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-zinc-500 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-3 py-2.5 font-normal whitespace-nowrap w-6"></th>
                  <th className="text-left px-4 py-2.5 font-normal whitespace-nowrap">行号</th>
                  <th className="text-left px-4 py-2.5 font-normal whitespace-nowrap">文件名</th>
                  <th className="text-left px-4 py-2.5 font-normal whitespace-nowrap">原始结论</th>
                  <th className="text-left px-4 py-2.5 font-normal whitespace-nowrap">方向（原始/当前）</th>
                  <th className="text-left px-4 py-2.5 font-normal whitespace-nowrap">巡检备注</th>
                  <th className="text-left px-4 py-2.5 font-normal whitespace-nowrap">状态</th>
                  <th className="text-left px-4 py-2.5 font-normal whitespace-nowrap">操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <Fragment key={item.id}>
                    <tr className="border-t border-zinc-100 hover:bg-zinc-50">
                      <td className="px-3 py-3">
                        <button
                          onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                          className="p-1 hover:bg-zinc-200 rounded"
                        >
                          {expandedId === item.id
                            ? <ChevronUp size={14} className="text-zinc-500" />
                            : <ChevronDown size={14} className="text-zinc-400" />
                          }
                        </button>
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-700">#{item.line_number}</td>
                      <td className="px-4 py-3 text-zinc-700 text-xs max-w-40 truncate" title={item.file_name}>{item.file_name}</td>
                      <td className="px-4 py-3 text-zinc-700 max-w-xs">{item.raw_conclusion}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {item.raw_direction_original && (
                            <div className="flex items-center gap-1 text-xs">
                              <span className="text-zinc-400">原始:</span>
                              <span className="text-zinc-500">{item.raw_direction_original}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <span className={`${item.boundary_flag ? 'text-amber-600 font-medium' : 'text-zinc-700'}`}>
                              {item.boundary_flag && '⚠ '}
                              {item.direction || '-'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-600 max-w-xs" title={item.remark}>
                        {item.remark
                          ? <span className="inline-block max-w-xs truncate">{item.remark}</span>
                          : <span className={item.status === '待实验老师复核' ? 'text-amber-500 text-xs' : 'text-zinc-300'}>
                              {item.status === '待实验老师复核' ? '⚠ 质检员未补' : '—'}
                            </span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={item.status} boundaryFlag={item.boundary_flag} />
                      </td>
                      <td className="px-4 py-3">
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
                    {expandedId === item.id && (
                      <tr key={`${item.id}-exp`} className="bg-zinc-50/60 border-t border-zinc-100">
                        <td colSpan={8} className="px-8 py-4">
                          <div className="grid grid-cols-3 gap-6 text-xs">
                            <div className="space-y-2">
                              <div className="font-semibold text-zinc-700 flex items-center gap-1">
                                <FileText size={12} /> 数据全链路证据
                              </div>
                              <div className="flex"><span className="w-24 text-zinc-400 shrink-0">原始结论：</span><span>{item.raw_conclusion}</span></div>
                              <div className="flex"><span className="w-24 text-zinc-400 shrink-0">原始方向（手写）：</span><span className="font-mono">{item.raw_direction_original || item.direction || '—'}</span></div>
                              <div className="flex"><span className="w-24 text-zinc-400 shrink-0">当前方向：</span><span>{item.direction || '—'}</span></div>
                              {item.direction_normalized && (
                                <div className="flex"><span className="w-24 text-zinc-400 shrink-0">建议归一值：</span><span className="text-blue-600">{item.direction_normalized}</span></div>
                              )}
                              <div className="flex"><span className="w-24 text-zinc-400 shrink-0">边界标记：</span>
                                <span className={item.boundary_flag ? 'text-amber-600' : 'text-zinc-500'}>
                                  {item.boundary_flag ? '已触发（不自动归正常）' : '未触发'}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="font-semibold text-zinc-700 flex items-center gap-1">
                                <User size={12} /> 巡检与复核
                              </div>
                              <div className="flex"><span className="w-24 text-zinc-400 shrink-0">巡检备注：</span><span>{item.remark || '—'}</span></div>
                              <div className="flex"><span className="w-24 text-zinc-400 shrink-0">当前状态：</span>
                                <StatusBadge status={item.status} boundaryFlag={item.boundary_flag} />
                              </div>
                              <div className="flex"><span className="w-24 text-zinc-400 shrink-0">触发边界规则：</span>
                                <span>{item.boundary_rule || '—'}</span>
                              </div>
                              <div className="flex"><span className="w-24 text-zinc-400 shrink-0">复核人：</span><span>{item.review_by || '—'}</span></div>
                              <div className="flex"><span className="w-24 text-zinc-400 shrink-0">复核理由：</span>
                                <span className="text-zinc-600 break-all">{item.review_reason || '—'}</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="font-semibold text-zinc-700 flex items-center gap-1">
                                <AlertTriangle size={12} /> 下一步 / 审计
                              </div>
                              <div className="flex"><span className="w-24 text-zinc-400 shrink-0">创建时间：</span><span>{item.created_at}</span></div>
                              <div className="flex"><span className="w-24 text-zinc-400 shrink-0">最近更新：</span><span>{item.updated_at}</span></div>
                              <div className="flex items-start">
                                <span className="w-24 text-zinc-400 shrink-0 pt-0.5">下一步：</span>
                                <span className={
                                  item.status === '待实验老师复核' ? 'text-amber-700 font-medium'
                                  : item.status === '退回' ? 'text-purple-700'
                                  : item.status === '已确认异常' ? 'text-red-700'
                                  : item.status === '归正常' ? 'text-emerald-700'
                                  : item.status === '已补看' ? 'text-blue-700'
                                  : 'text-zinc-600'
                                }>
                                  {item.status === '待实验老师复核' && '实验老师需人工复核方向与结论'}
                                  {item.status === '退回' && '质检员需重新处理，再次补看'}
                                  {item.status === '已确认异常' && '已归档，进入异常处理流程'}
                                  {item.status === '归正常' && '已归正常，流程完成'}
                                  {item.status === '已补看' && '质检员补看完成，无待复核项'}
                                  {item.status === '待补看' && '等待质检员补看手写巡检备注'}
                                </span>
                              </div>
                              <div className="pt-1">
                                <Link to={`/history/${item.id}`} target="_blank" className="text-[#1B3A4B] underline text-xs">
                                  → 查看完整变更历史（所有改前改后的值）
                                </Link>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {reviewingId && reviewingItem && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setReviewingId(null)}>
          <div className="bg-white rounded-lg p-6 w-[480px] shadow-xl max-w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-zinc-800 mb-4 flex items-center gap-2">
              <Shield size={18} className="text-[#1B3A4B]" />
              实验老师复核
            </h3>

            <div className="mb-4 p-3 bg-zinc-50 rounded text-xs space-y-1.5">
              <div className="flex"><span className="w-20 text-zinc-400 shrink-0">行号：</span>#{reviewingItem.line_number}</div>
              <div className="flex"><span className="w-20 text-zinc-400 shrink-0">原始方向：</span>
                <span className="font-mono text-zinc-600">{reviewingItem.raw_direction_original || reviewingItem.direction}</span>
              </div>
              {reviewingItem.raw_direction_original && reviewingItem.raw_direction_original !== reviewingItem.direction && (
                <div className="flex"><span className="w-20 text-zinc-400 shrink-0">改后方向：</span>
                  <span className="font-mono text-zinc-700">{reviewingItem.direction}</span>
                </div>
              )}
              {reviewingItem.direction_normalized && (
                <div className="flex"><span className="w-20 text-zinc-400 shrink-0">建议归一：</span>
                  <span className="text-blue-600">{reviewingItem.direction_normalized}</span>
                </div>
              )}
              <div className="flex"><span className="w-20 text-zinc-400 shrink-0">巡检备注：</span>
                {reviewingItem.remark
                  ? <span className="text-zinc-700 break-all">{reviewingItem.remark}</span>
                  : <span className="text-amber-600">（质检员尚未补录手写巡检备注）</span>
                }
              </div>
              {reviewingItem.review_reason && (
                <div className="flex"><span className="w-20 text-zinc-400 shrink-0">历史原因：</span>
                  <span className="text-zinc-600 break-all">{reviewingItem.review_reason}</span>
                </div>
              )}
            </div>

            <div className="mb-4">
              <p className="text-sm text-zinc-500 mb-1">复核操作</p>
              <p className={`font-semibold ${actionLabels[reviewAction!]?.color}`}>
                {actionLabels[reviewAction!]?.label}
              </p>
              <p className="text-xs text-zinc-400 mt-1 flex items-center gap-1">
                <User size={11} />
                下一步责任人：{actionLabels[reviewAction!]?.nextOwner}
              </p>
            </div>
            <div className="mb-5">
              <label className="block text-sm text-zinc-500 mb-1">复核理由（必填，将记入变更历史）</label>
              <textarea
                value={reviewReason}
                onChange={e => setReviewReason(e.target.value)}
                className="w-full p-3 text-sm border border-zinc-200 rounded focus:outline-none focus:border-[#1B3A4B] resize-none"
                rows={3}
                placeholder={`请说明${actionLabels[reviewAction!]?.label}的判断依据...`}
                autoFocus
              />
              <p className="text-xs text-zinc-400 mt-1.5">
                原始说法、改后值、本理由、下一步责任人均会写入变更历史，便于后续追溯。
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setReviewingId(null); setReviewAction(null); setReviewReason('') }}
                className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded"
              >
                取消
              </button>
              <button
                onClick={handleReview}
                disabled={!reviewReason.trim() || loading}
                className="px-4 py-2 text-sm bg-[#1B3A4B] text-white rounded hover:bg-[#152d3a] disabled:opacity-50"
              >
                确认提交
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
