import { useState } from 'react'
import { AlertTriangle, CheckCircle, XCircle, MessageSquare, ArrowRight } from 'lucide-react'
import { useVarStore } from '@/store'
import type { ConflictRecord } from '@/types'

function ConflictCard({ conflict }: { conflict: ConflictRecord }) {
  const { rows, boundaryNotes, resolveConflict, setSelectedConflictId } = useVarStore()
  const [showDecision, setShowDecision] = useState(false)
  const [reason, setReason] = useState('')

  const row = rows.find((r) => r.id === conflict.rowId)
  const note = boundaryNotes.find((n) => n.id === conflict.boundaryNoteId)

  const handleResolve = (status: 'confirmed' | 'rejected') => {
    if (!reason.trim()) return
    resolveConflict(conflict.id, status, '唐老师', reason)
    setShowDecision(false)
    setReason('')
  }

  return (
    <div className={`card overflow-hidden ${conflict.status === 'pending' ? 'border-accent-red/30' : ''}`}>
      <div className="px-5 py-3 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className={conflict.status === 'pending' ? 'text-accent-red' : 'text-text-muted'} />
          <span className="text-sm font-mono text-text-gold">{conflict.id}</span>
          <span className="text-xs text-text-muted font-sans">· {conflict.field}</span>
        </div>
        {conflict.status === 'pending' && <span className="badge-red">待裁决</span>}
        {conflict.status === 'confirmed' && <span className="badge-green">已确认</span>}
        {conflict.status === 'rejected' && <span className="badge-muted">已驳回</span>}
      </div>

      <div className="p-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-base-700/70 rounded-lg p-4 border border-surface-border">
            <div className="text-xs text-text-muted font-sans mb-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-gold" />
              问卷原始行
            </div>
            <div className="text-sm font-mono text-text-primary mb-2">
              {row ? (
                <>
                  <span className="text-text-muted text-xs">#{row.rowIndex}</span>{' '}
                  <span className="font-sans">{row.fields.portfolio}</span>
                </>
              ) : (
                '-'
              )}
            </div>
            <div className="bg-base-800/80 rounded px-3 py-2">
              <span className="text-xs text-text-muted font-sans">值：</span>
              <span className="text-sm font-mono text-accent-amber">{conflict.originalValue}</span>
            </div>
          </div>

          <div className="bg-base-700/70 rounded-lg p-4 border border-accent-red/20">
            <div className="text-xs text-text-muted font-sans mb-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-red" />
              边界值说明
            </div>
            <div className="text-sm font-mono text-text-primary mb-2">
              {note ? <span className="font-sans">{note.fieldName}</span> : '-'}
            </div>
            <div className="bg-base-800/80 rounded px-3 py-2">
              <span className="text-xs text-text-muted font-sans">要求：</span>
              <span className="text-sm font-sans text-accent-red">{conflict.boundaryValue}</span>
            </div>
          </div>
        </div>

        {conflict.status !== 'pending' && (
          <div className="mt-4 bg-base-700/30 rounded-lg p-3 border border-surface-border">
            <div className="flex items-center gap-2 text-xs text-text-muted font-sans">
              <span>裁决人：{conflict.decidedBy}</span>
              <span>·</span>
              <span>{conflict.status === 'confirmed' ? '确认冲突' : '驳回冲突'}</span>
              <span>·</span>
              <span>{conflict.decidedAt ? new Date(conflict.decidedAt).toLocaleString('zh-CN') : '-'}</span>
            </div>
            {conflict.reason && (
              <p className="text-xs text-text-secondary font-sans mt-1">理由：{conflict.reason}</p>
            )}
          </div>
        )}

        {conflict.status === 'pending' && !showDecision && (
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => setShowDecision(true)}
              className="btn-primary flex items-center gap-1.5"
            >
              <MessageSquare size={14} />
              裁决此冲突
            </button>
            <button
              onClick={() => setSelectedConflictId(conflict.id)}
              className="btn-ghost text-xs flex items-center gap-1"
            >
              <ArrowRight size={12} />
              查看关联明细
            </button>
          </div>
        )}

        {conflict.status === 'pending' && showDecision && (
          <div className="mt-4 bg-base-700/50 border border-surface-border rounded-lg p-4 space-y-3">
            <label className="block text-xs text-text-secondary font-sans">裁决理由（必填）</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="请说明确认或驳回的理由..."
              className="w-full bg-base-800 border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary font-sans placeholder-text-muted focus:outline-none focus:border-accent-gold/50 resize-none h-20"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleResolve('confirmed')}
                disabled={!reason.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium border border-accent-green/50 bg-accent-green/10 text-text-green hover:bg-accent-green/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-sans"
              >
                <CheckCircle size={14} />
                确认冲突
              </button>
              <button
                onClick={() => handleResolve('rejected')}
                disabled={!reason.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium border border-accent-red/50 bg-accent-red/10 text-text-red hover:bg-accent-red/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-sans"
              >
                <XCircle size={14} />
                驳回冲突
              </button>
              <button
                onClick={() => {
                  setShowDecision(false)
                  setReason('')
                }}
                className="btn-ghost text-xs"
              >
                取消
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Conflict() {
  const { conflicts, rows } = useVarStore()

  const pendingConflicts = conflicts.filter((c) => c.status === 'pending')
  const resolvedConflicts = conflicts.filter((c) => c.status !== 'pending')
  const mixedFormatRows = rows.filter((r) => r.formatType === 'mixed')

  return (
    <div className="min-h-screen p-6 space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-text-primary font-sans">冲突与复核</h1>
        <p className="text-xs text-text-muted font-sans mt-1">
          原始行与边界值说明矛盾时列出冲突证据，百分数/小数混搭不自动归正常
        </p>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <div className="text-2xl font-mono text-accent-red font-bold">{pendingConflicts.length}</div>
          <div className="text-xs text-text-muted font-sans mt-1">待裁决冲突</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-mono text-accent-amber font-bold">{mixedFormatRows.length}</div>
          <div className="text-xs text-text-muted font-sans mt-1">格式混搭待复核</div>
        </div>
        <div className="card p-4">
          <div className="text-2xl font-mono text-accent-green font-bold">{resolvedConflicts.length}</div>
          <div className="text-xs text-text-muted font-sans mt-1">已裁决</div>
        </div>
      </div>

      {pendingConflicts.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-text-red font-sans mb-3 flex items-center gap-2">
            <AlertTriangle size={16} />
            冲突证据列表
          </h2>
          <div className="space-y-4">
            {pendingConflicts.map((c) => (
              <ConflictCard key={c.id} conflict={c} />
            ))}
          </div>
        </section>
      )}

      {mixedFormatRows.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-accent-amber font-sans mb-3 flex items-center gap-2">
            <AlertTriangle size={16} />
            待复核队列（百分数/小数混搭）
          </h2>
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-surface-border">
              <span className="text-xs text-text-muted font-sans">
                以下记录存在百分数与小数混搭，不自动归正常，需活动负责人复核
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>投资组合</th>
                    <th>置信度</th>
                    <th>VaR</th>
                    <th>备注</th>
                    <th>复核状态</th>
                  </tr>
                </thead>
                <tbody>
                  {mixedFormatRows.map((row) => (
                    <tr key={row.id} className="bg-accent-amber/5">
                      <td className="text-text-muted">{row.rowIndex}</td>
                      <td className="text-text-primary">{row.fields.portfolio}</td>
                      <td>
                        <span className="text-accent-amber">{row.fields.confidence}</span>
                      </td>
                      <td>
                        <span className="text-accent-amber">{row.fields.varAmount}</span>
                      </td>
                      <td className="max-w-[240px] truncate text-text-secondary text-xs font-sans">
                        {row.remark || '—'}
                      </td>
                      <td>
                        <span className="badge-gold">待复核</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {resolvedConflicts.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-text-secondary font-sans mb-3">已裁决记录</h2>
          <div className="space-y-3 opacity-70">
            {resolvedConflicts.map((c) => (
              <ConflictCard key={c.id} conflict={c} />
            ))}
          </div>
        </section>
      )}

      {conflicts.length === 0 && mixedFormatRows.length === 0 && (
        <div className="card p-12 text-center">
          <CheckCircle size={40} className="text-accent-green mx-auto mb-3" />
          <p className="text-sm text-text-secondary font-sans">暂无冲突或待复核项</p>
          <p className="text-xs text-text-muted font-sans mt-1">所有数据均已通过校验</p>
        </div>
      )}
    </div>
  )
}
