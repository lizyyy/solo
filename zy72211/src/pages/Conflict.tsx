import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { Scale, CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import type { ConflictResolution } from '@/types'

export default function Conflict() {
  const conflicts = useStore((s) => s.conflicts)
  const records = useStore((s) => s.records)
  const resolveConflict = useStore((s) => s.resolveConflict)

  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [resolving, setResolving] = useState<string | null>(null)

  const pending = conflicts.filter((c) => c.resolution === '待裁决')
  const resolved = conflicts.filter((c) => c.resolution !== '待裁决')

  const handleResolve = (conflictId: string, resolution: ConflictResolution) => {
    const reason = reasons[conflictId] || ''
    resolveConflict(conflictId, resolution, '阿芬', reason)
    setResolving(null)
    setReasons((prev) => {
      const next = { ...prev }
      delete next[conflictId]
      return next
    })
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h2
          className="text-2xl font-bold text-[#1a365d] mb-1"
          style={{ fontFamily: '"Noto Serif SC", serif' }}
        >
          冲突裁决
        </h2>
        <p className="text-sm text-slate-400">双源证据矛盾时，由对账运营阿芬人工裁决，不自动拍板</p>
      </div>

      {conflicts.length === 0 && (
        <div className="text-center py-16">
          <Scale size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-400 text-sm">暂无冲突记录</p>
          <p className="text-xs text-slate-300 mt-1">当节假日顺延说明与尾差调整条数据矛盾时，冲突会出现在此处</p>
        </div>
      )}

      {pending.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-amber-500" />
            <h3 className="text-sm font-semibold text-amber-700">待裁决冲突（{pending.length}）</h3>
          </div>
          <div className="space-y-4">
            {pending.map((c) => {
              const record = records.find((r) => r.id === c.recordId)
              return (
                <div
                  key={c.id}
                  className="bg-white rounded-xl border-2 border-amber-200 p-6 shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
                      冲突字段：{c.conflictField}
                    </span>
                    <span className="text-xs text-slate-400">
                      关联记录：{record?.name || c.recordId}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-6 mb-5">
                    <div className="bg-emerald-50 rounded-lg p-5 border border-emerald-200">
                      <p className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        节假日顺延说明
                      </p>
                      <p className="text-sm text-slate-700 leading-relaxed">{c.holidayEvidence}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-5 border border-blue-200">
                      <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        尾差调整条
                      </p>
                      <p className="text-sm text-slate-700 leading-relaxed">{c.adjustmentEvidence}</p>
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-xs font-medium text-slate-500 mb-1">
                      裁决理由（必填）
                    </label>
                    <input
                      type="text"
                      value={reasons[c.id] || ''}
                      onChange={(e) =>
                        setReasons((prev) => ({ ...prev, [c.id]: e.target.value }))
                      }
                      placeholder="请说明确认或驳回的理由"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-400 transition"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleResolve(c.id, '已确认')}
                      disabled={!reasons[c.id]}
                      className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <CheckCircle size={16} />
                      确认（采纳尾差调整条）
                    </button>
                    <button
                      onClick={() => handleResolve(c.id, '已驳回')}
                      disabled={!reasons[c.id]}
                      className="flex items-center gap-2 px-5 py-2.5 border-2 border-amber-400 text-amber-700 text-sm font-medium rounded-lg hover:bg-amber-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <XCircle size={16} />
                      驳回（保留顺延说明）
                    </button>
                    {resolving === c.id && (
                      <span className="text-xs text-slate-400">处理中…</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle size={16} className="text-emerald-500" />
            <h3 className="text-sm font-semibold text-emerald-700">已裁决冲突（{resolved.length}）</h3>
          </div>
          <div className="space-y-3">
            {resolved.map((c) => (
              <div key={c.id} className="bg-white rounded-lg border border-slate-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500">冲突字段：{c.conflictField}</span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded ${
                      c.resolution === '已确认'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {c.resolution}
                  </span>
                </div>
                <p className="text-sm text-slate-700 mb-1">
                  {c.resolution === '已确认' ? '采纳尾差调整条' : '保留顺延说明'}
                </p>
                <p className="text-xs text-slate-400">
                  裁决人：{c.resolvedBy} · 理由：{c.resolveReason} · 时间：
                  {new Date(c.resolvedAt).toLocaleString('zh-CN')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
