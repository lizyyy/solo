import { useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, User, FileText } from 'lucide-react'
import { useAssessmentStore } from '@/stores/assessmentStore'
import DiffView from '@/components/DiffView'
import StatusBadge from '@/components/StatusBadge'

const fieldLabels: Record<string, string> = {
  status: '状态',
  remark: '巡检备注',
  direction: '方向',
  boundary_flag: '边界标记',
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

  const formatTime = (t: string) => new Date(t).toLocaleString('zh-CN')

  return (
    <div className="p-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-5">
        <ArrowLeft size={14} />
        返回
      </button>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-800">变更历史</h1>
        {currentItem && (
          <p className="text-sm text-zinc-500 mt-1">
            行号 {currentItem.line_number} · {currentItem.file_name} · <StatusBadge status={currentItem.status} boundaryFlag={currentItem.boundary_flag} />
          </p>
        )}
      </div>

      {loading ? (
        <div className="text-sm text-zinc-400">加载中...</div>
      ) : history.length === 0 ? (
        <div className="bg-white rounded-lg border border-zinc-200 p-12 text-center text-zinc-400">
          <Clock size={40} className="mx-auto mb-2" />
          <p className="text-sm">暂无变更记录</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-zinc-200 overflow-hidden">
          {history.map((record, idx) => (
            <div key={record.id} className={`flex ${idx !== history.length - 1 ? 'border-b border-zinc-100' : ''}`}>
              <div className="w-44 shrink-0 px-5 py-4 border-r border-zinc-100">
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
                <div className="flex items-start gap-3 mb-1">
                  <span className="text-sm font-medium text-zinc-700">
                    <FileText size={14} className="inline mr-1.5" />
                    {fieldLabels[record.field] || record.field}
                  </span>
                </div>
                <div className="text-sm">
                  <DiffView oldValue={record.old_value} newValue={record.new_value} />
                </div>
                {record.reason && (
                  <div className="text-xs text-zinc-400 mt-2">
                    理由：{record.reason}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-zinc-50 rounded-lg text-xs text-zinc-500">
        <p className="font-medium text-zinc-600 mb-1">审计追踪说明</p>
        <p>所有字段变更均保留原始行号、人工改动、当前处理状态。实验老师复核时可直接追溯到每一步的证据，而非仅看汇总数。</p>
      </div>
    </div>
  )
}
