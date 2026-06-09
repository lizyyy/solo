import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, User, FileText, AlertTriangle, Shield } from 'lucide-react'
import { useAssessmentStore } from '@/stores/assessmentStore'
import DiffView from '@/components/DiffView'
import StatusBadge from '@/components/StatusBadge'

const fieldLabels: Record<string, { label: string; highlight?: boolean }> = {
  status: { label: '状态', highlight: true },
  remark: { label: '巡检备注' },
  direction: { label: '方向' },
  direction_normalized: { label: '建议归一值' },
  boundary_flag: { label: '边界标记', highlight: true },
  review_reason: { label: '复核原因', highlight: true },
  review_by: { label: '复核人 / 下一步' },
  raw_direction_original: { label: '原始方向（手写保留）' },
}

export default function HistoryPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentItem, history, fetchItem, fetchHistory, loading } = useAssessmentStore()

  useEffect(() => {
    if (id) {
      fetchItem(id)
      fetchHistory(id)
    }
  }, [id])

  const formatTime = (t: string) => {
    try { return new Date(t).toLocaleString('zh-CN', { hour12: false }) } catch { return t }
  }

  const summaryCounts = history.reduce((acc, r) => {
    acc[r.field] = (acc[r.field] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-5">
        <ArrowLeft size={14} />
        返回上一页
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-800">变更历史</h1>
        {currentItem && (
          <div className="mt-2 space-y-1">
            <p className="text-sm text-zinc-500 flex items-center gap-2">
              行号 <span className="font-mono text-zinc-700">#{currentItem.line_number}</span>
              <span className="text-zinc-300">·</span>
              {currentItem.file_name}
              <span className="text-zinc-300">·</span>
              <StatusBadge status={currentItem.status} boundaryFlag={currentItem.boundary_flag} />
            </p>
            <p className="text-xs text-zinc-400">
              此页列表、详情、异常表、摘要全部基于同一份 <code className="bg-zinc-100 px-1 rounded">assessment_items(id={currentItem.id})</code> 记录
            </p>
          </div>
        )}
      </div>

      {currentItem && (
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-700 flex items-center gap-1.5">
              <Shield size={14} /> 当前快照（最新）
            </span>
            <span className="text-xs text-zinc-400">更新于 {formatTime(currentItem.updated_at)}</span>
          </div>
          <div className="px-5 py-4 grid grid-cols-2 gap-x-8 gap-y-3 text-xs">
            <div className="flex"><span className="w-28 text-zinc-400 shrink-0">原始行号：</span><span className="font-mono text-zinc-700">#{currentItem.line_number}</span></div>
            <div className="flex"><span className="w-28 text-zinc-400 shrink-0">文件名：</span><span className="text-zinc-700 break-all">{currentItem.file_name}</span></div>
            <div className="flex"><span className="w-28 text-zinc-400 shrink-0">原始结论：</span><span className="text-zinc-700">{currentItem.raw_conclusion}</span></div>
            <div className="flex"><span className="w-28 text-zinc-400 shrink-0">当前状态：</span>
              <StatusBadge status={currentItem.status} boundaryFlag={currentItem.boundary_flag} />
            </div>
            <div className="flex items-start"><span className="w-28 text-zinc-400 shrink-0 pt-0.5">原始手写方向：</span>
              <span className={`font-mono ${currentItem.boundary_flag ? 'text-amber-600' : 'text-zinc-700'}`}>
                {currentItem.raw_direction_original || currentItem.direction || '（未填写）'}
              </span>
            </div>
            <div className="flex"><span className="w-28 text-zinc-400 shrink-0">当前方向：</span><span className="text-zinc-700">{currentItem.direction || '（无）'}</span></div>
            {currentItem.direction_normalized && (
              <div className="flex"><span className="w-28 text-zinc-400 shrink-0">建议归一值：</span><span className="text-blue-600">{currentItem.direction_normalized}</span></div>
            )}
            <div className="flex"><span className="w-28 text-zinc-400 shrink-0">边界规则：</span>
              <span className={currentItem.boundary_flag ? 'text-amber-600' : 'text-zinc-500'}>
                {currentItem.boundary_flag ? `${currentItem.boundary_rule || '已触发'}，不归正常` : '未触发'}
              </span>
            </div>
            <div className="flex items-start col-span-2"><span className="w-28 text-zinc-400 shrink-0 pt-0.5">巡检备注：</span>
              <span className="text-zinc-700 whitespace-pre-wrap">{currentItem.remark || '（未补）'}</span>
            </div>
            <div className="flex"><span className="w-28 text-zinc-400 shrink-0">复核人：</span><span>{currentItem.review_by || '—'}</span></div>
            <div className="flex items-start"><span className="w-28 text-zinc-400 shrink-0 pt-0.5">复核/处理原因：</span>
              <span className="text-zinc-600 break-all">{currentItem.review_reason || '—'}</span>
            </div>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="bg-white rounded-lg border border-zinc-200 p-4 mb-6 text-xs">
          <div className="font-semibold text-zinc-700 mb-2">改动字段统计</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(summaryCounts).map(([field, count]) => (
              <span key={field} className="inline-flex items-center gap-1 px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded">
                {fieldLabels[field]?.label || field}
                <span className="text-zinc-400">×{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-zinc-400">加载中...</div>
      ) : history.length === 0 ? (
        <div className="bg-white rounded-lg border border-zinc-200 p-12 text-center text-zinc-400">
          <Clock size={40} className="mx-auto mb-2" />
          <p className="text-sm">暂无变更记录</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-zinc-100 bg-zinc-50 text-xs font-semibold text-zinc-700 flex items-center gap-1.5">
            <Clock size={13} /> 完整改动时间线（按时间倒序，仅记录实际变化字段）
          </div>
          <ol className="relative">
            {history.map((record, idx) => {
              const fieldMeta = fieldLabels[record.field] || { label: record.field, highlight: false }
              return (
                <li key={record.id} className={`flex ${idx !== history.length - 1 ? 'border-b border-zinc-100' : ''}`}>
                  <div className="w-48 shrink-0 px-5 py-4 border-r border-zinc-100 relative">
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
                      <Clock size={12} />
                      {formatTime(record.changed_at)}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                      <User size={12} />
                      {record.changed_by}
                    </div>
                  </div>
                  <div className="flex-1 px-5 py-4">
                    <div className="flex items-start gap-3 mb-1.5">
                      <span className={`text-sm font-semibold ${fieldMeta.highlight ? 'text-[#1B3A4B]' : 'text-zinc-700'} flex items-center gap-1.5`}>
                        {fieldMeta.highlight && <AlertTriangle size={13} className="text-amber-500" />}
                        <FileText size={13} className="text-zinc-400" />
                        {fieldMeta.label}
                      </span>
                    </div>
                    <div className="text-sm">
                      <DiffView oldValue={record.old_value} newValue={record.new_value} />
                    </div>
                    {record.reason && (
                      <div className="mt-2.5 p-2 bg-blue-50 rounded text-xs text-blue-700 border border-blue-100">
                        <span className="font-semibold">处理说明：</span>
                        {record.reason}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      )}

      <div className="mt-6 p-4 bg-zinc-50 rounded-lg text-xs text-zinc-500 border border-zinc-200">
        <p className="font-semibold text-zinc-600 mb-1.5 flex items-center gap-1.5">
          <Shield size={13} /> 审计追踪说明
        </p>
        <ul className="space-y-1 list-disc list-inside">
          <li>所有改动均保留：原始行号、改前值、改后值、改动人、时间、处理原因</li>
          <li>人工复核项额外保留：原始说法（raw_direction_original）、改后值（direction）、处理原因（review_reason）、下一步责任人（review_by）</li>
          <li>边界命中（如"向左"）不归入正常，必须实验老师人工判定后才能进入"归正常"状态</li>
          <li>列表、详情、异常表、摘要、导出/报告均读取同一条记录的最新数据，与变更历史完全一致</li>
        </ul>
      </div>
    </div>
  )
}
