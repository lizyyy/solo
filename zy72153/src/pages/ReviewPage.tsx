import { useState } from 'react'
import { useStore } from '@/lib/store'
import { CONFLICT_TYPE_LABELS, STATUS_LABELS, type ConflictType, type ConflictItem } from '@/types'
import { AlertTriangle, CheckCircle, XCircle, Clock, ChevronRight } from 'lucide-react'

type StatusFilter = 'all' | 'pending' | 'confirmed' | 'rejected' | 'deferred'

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'pending', label: '待处理' },
  { key: 'confirmed', label: '已确认' },
  { key: 'rejected', label: '已驳回' },
  { key: 'deferred', label: '暂缓' },
]

const STATUS_ICON = {
  pending: AlertTriangle,
  confirmed: CheckCircle,
  rejected: XCircle,
  deferred: Clock,
} as const

const TYPE_BG: Record<ConflictType, string> = {
  capacity_overflow: 'bg-amber-100 text-amber-800',
  time_conflict: 'bg-amber-100 text-amber-800',
  data_mismatch: 'bg-amber-100 text-amber-800',
  null_value: 'bg-amber-100 text-amber-800',
  boundary: 'bg-amber-100 text-amber-800',
}

const STATUS_BG: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-800',
  deferred: 'bg-blue-100 text-blue-800',
}

export default function ReviewPage() {
  const { conflicts, resolveConflict } = useStore()
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [typeFilter, setTypeFilter] = useState<ConflictType | 'all'>('all')
  const [resolutions, setResolutions] = useState<Record<string, string>>({})

  const total = conflicts.length
  const resolved = conflicts.filter(c => c.status !== 'pending').length
  const pending = total - resolved
  const pct = total > 0 ? (resolved / total) * 100 : 0

  const filtered = conflicts.filter(c => {
    if (statusFilter !== 'all' && c.status !== statusFilter) return false
    if (typeFilter !== 'all' && c.conflictType !== typeFilter) return false
    return true
  })

  const nullValueConflicts = filtered.filter(c => c.conflictType === 'null_value')
  const otherConflicts = filtered.filter(c => c.conflictType !== 'null_value')

  const handleResolve = (id: string, resolution: string, status: ConflictItem['status']) => {
    resolveConflict(id, resolution, status)
  }

  return (
    <div>
      <h1 className="font-serif-title text-2xl font-semibold text-teal-800">复核台</h1>
      <p className="text-stone-400 text-sm">审查冲突数据，确认归并结果</p>

      <div className="card p-4 mb-5 mt-4">
        <div className="flex justify-between text-sm mb-2">
          <span>总冲突 <strong>{total}</strong></span>
          <span>待处理 <strong className="text-amber-600">{pending}</strong></span>
          <span>已处理 <strong className="text-teal-600">{resolved}</strong></span>
        </div>
        <div className="h-2 bg-stone-200 rounded-full">
          <div className="h-2 bg-teal-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key}
            className={statusFilter === tab.key ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setStatusFilter(tab.key)}
          >
            {tab.label}
          </button>
        ))}
        <select
          className="select-field"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as ConflictType | 'all')}
        >
          <option value="all">全部类型</option>
          {(Object.entries(CONFLICT_TYPE_LABELS) as [ConflictType, string][]).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-4">
        {otherConflicts.map(conflict => {
          const Icon = STATUS_ICON[conflict.status] ?? AlertTriangle
          return (
            <div key={conflict.id} className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_BG[conflict.conflictType]}`}>
                  {CONFLICT_TYPE_LABELS[conflict.conflictType]}
                </span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BG[conflict.status]}`}>
                  <Icon className="w-3 h-3 inline mr-1" />
                  {STATUS_LABELS[conflict.status]}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <div className="text-xs text-stone-500 mb-1 font-medium">导入数据证据</div>
                  <div className="bg-stone-50 p-3 rounded text-sm">
                    {conflict.pointEvidence || '无'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-stone-500 mb-1 font-medium">审批台账证据</div>
                  {conflict.approvalEvidence ? (
                    <div className="bg-stone-50 p-3 rounded text-sm">{conflict.approvalEvidence}</div>
                  ) : (
                    <div className="bg-stone-50 p-3 rounded text-sm text-stone-400 italic">
                      该冲突无审批台账对照
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-3">
                <div className="text-xs text-stone-500 mb-1 font-medium">建议动作</div>
                <div className="bg-amber-50 border-l-4 border-amber-400 p-3 text-sm">
                  {conflict.suggestion}
                </div>
              </div>

              {conflict.status === 'pending' ? (
                <>
                  <textarea
                    className="input-field mb-3"
                    rows={2}
                    placeholder="填写处理说明…"
                    value={resolutions[conflict.id] || ''}
                    onChange={e => setResolutions(prev => ({ ...prev, [conflict.id]: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <button
                      className="btn-primary bg-sage-700 hover:bg-sage-800"
                      onClick={() => handleResolve(conflict.id, resolutions[conflict.id] || '确认', 'confirmed')}
                    >
                      确认
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => handleResolve(conflict.id, '驳回', 'rejected')}
                    >
                      驳回
                    </button>
                    <button
                      className="btn-warning"
                      onClick={() => handleResolve(conflict.id, '暂缓处理', 'deferred')}
                    >
                      暂缓
                    </button>
                  </div>
                </>
              ) : (
                <div className="bg-stone-50 p-3 rounded text-sm">
                  {conflict.resolution}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {nullValueConflicts.length > 0 && (
        <div className="mt-6">
          <h2 className="font-serif-title text-lg font-semibold text-teal-800 mb-3 flex items-center gap-2">
            <ChevronRight className="w-5 h-5" />
            空值 / 边界记录
          </h2>
          <div className="flex flex-col gap-3">
            {nullValueConflicts.map(conflict => (
              <div key={conflict.id} className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_BG[conflict.conflictType]}`}>
                    {CONFLICT_TYPE_LABELS[conflict.conflictType]}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_BG[conflict.status]}`}>
                    {STATUS_LABELS[conflict.status]}
                  </span>
                </div>
                <div className="bg-stone-50 p-3 rounded text-sm mb-2">{conflict.pointEvidence || '无'}</div>
                <div className="bg-amber-50 border-l-4 border-amber-400 p-3 text-sm">{conflict.suggestion}</div>
                {conflict.status === 'pending' && (
                  <div className="flex gap-2 mt-2">
                    <button
                      className="btn-primary bg-sage-700 hover:bg-sage-800"
                      onClick={() => handleResolve(conflict.id, '确认', 'confirmed')}
                    >
                      确认
                    </button>
                    <button
                      className="btn-danger"
                      onClick={() => handleResolve(conflict.id, '驳回', 'rejected')}
                    >
                      驳回
                    </button>
                    <button
                      className="btn-warning"
                      onClick={() => handleResolve(conflict.id, '暂缓处理', 'deferred')}
                    >
                      暂缓
                    </button>
                  </div>
                )}
                {conflict.status !== 'pending' && (
                  <div className="bg-stone-50 p-3 rounded text-sm mt-2">{conflict.resolution}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 && (
        <div className="text-center text-stone-400 py-10">暂无冲突数据</div>
      )}
    </div>
  )
}
