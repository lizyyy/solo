import { useState } from 'react'
import { AlertTriangle, CheckCircle, XCircle, MessageSquare, ArrowRight, Eye, FileWarning } from 'lucide-react'
import { useVarStore } from '@/store'
import type { ConflictRecord } from '@/types'

function ConflictCard({ conflict }: { conflict: ConflictRecord }) {
  const {
    rows,
    boundaryNotes,
    resolveConflict,
    setSelectedConflictId,
    setSelectedRowId,
    calculations,
  } = useVarStore()
  const [showDecision, setShowDecision] = useState(false)
  const [reason, setReason] = useState('')
  const [resolvedValue, setResolvedValue] = useState(conflict.suggestedValue || '')
  const [applyToRow, setApplyToRow] = useState(true)

  const row = rows.find((r) => r.id === conflict.rowId)
  const note = boundaryNotes.find((n) => n.id === conflict.boundaryNoteId)
  const calc = calculations.find((c) => c.rowId === conflict.rowId)

  const handleResolve = (status: 'confirmed' | 'rejected') => {
    if (!reason.trim()) return
    resolveConflict(
      conflict.id,
      status,
      '唐老师',
      reason,
      status === 'confirmed' ? resolvedValue || conflict.suggestedValue : undefined,
      status === 'confirmed' ? applyToRow : false
    )
    setShowDecision(false)
    setReason('')
  }

  return (
    <div
      className={`card overflow-hidden ${conflict.status === 'pending' ? 'border-accent-red/30 shadow-[0_0_16px_rgba(231,76,60,0.08)]' : ''}`}
    >
      <div className="px-5 py-3 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <AlertTriangle
            size={14}
            className={conflict.status === 'pending' ? 'text-accent-red' : 'text-text-muted'}
          />
          <span className="text-sm font-mono text-text-gold">{conflict.id}</span>
          <span className="text-xs text-text-muted font-sans">· {conflict.field}</span>
          {row && (
            <span className="text-xs text-text-secondary font-mono">
              → {row.fields.portfolio}
            </span>
          )}
          {conflict.status !== 'pending' &&
            conflict.resolvedValue &&
            conflict.originalValue !== conflict.resolvedValue && (
              <span className="badge-green">
                {conflict.originalValue} → {conflict.resolvedValue}
              </span>
            )}
        </div>
        <div className="flex items-center gap-2">
          {row && (
            <button
              onClick={() => setSelectedRowId(row.id)}
              className="btn-ghost text-[10px] py-1 px-2 flex items-center gap-1"
            >
              <Eye size={11} />
              行详情
            </button>
          )}
          {conflict.status === 'pending' && <span className="badge-red">待裁决</span>}
          {conflict.status === 'confirmed' && <span className="badge-green">已确认</span>}
          {conflict.status === 'rejected' && <span className="badge-muted">已驳回</span>}
        </div>
      </div>

      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-base-700/70 rounded-lg p-4 border border-surface-border">
            <div className="text-xs text-text-muted font-sans mb-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-gold" />
              问卷原始行
            </div>
            <div className="text-sm font-sans text-text-primary mb-2">
              {row ? (
                <>
                  <span className="text-text-muted text-xs">#{row.rowIndex}</span>{' '}
                  <span>{row.fields.portfolio}</span>
                </>
              ) : (
                '-'
              )}
            </div>
            <div className="bg-base-800/80 rounded px-3 py-2 mb-2">
              <span className="text-xs text-text-muted font-sans">字段：</span>
              <span className="text-sm font-mono text-accent-amber">{conflict.originalValue}</span>
              <span className="text-[10px] text-text-muted ml-2">（原始说法，永远保留）</span>
            </div>
            {row && (
              <div className="text-[11px] text-text-secondary font-sans leading-relaxed max-h-[80px] overflow-y-auto">
                <span className="text-text-muted">备注：</span>
                {row.remark || '无'}
              </div>
            )}
          </div>

          <div className="bg-base-700/70 rounded-lg p-4 border border-accent-red/20">
            <div className="text-xs text-text-muted font-sans mb-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-red" />
              边界值说明
              {note?.appliedRowIds.includes(conflict.rowId) && (
                <span className="ml-auto badge-green">已生效到行</span>
              )}
            </div>
            <div className="text-sm font-mono text-text-primary mb-2">
              {note ? <span className="font-sans">{note.fieldName}</span> : '-'}
            </div>
            <div className="bg-base-800/80 rounded px-3 py-2 mb-2">
              <span className="text-xs text-text-muted font-sans">规则：</span>
              <span className="text-sm font-sans text-accent-red">{conflict.boundaryValue}</span>
            </div>
            {note && (
              <div className="text-[11px] text-text-secondary font-sans leading-relaxed max-h-[80px] overflow-y-auto">
                {note.originalText}
              </div>
            )}
          </div>
        </div>

        {conflict.status !== 'pending' && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-base-700/30 rounded-lg p-3 border border-surface-border">
              <div className="flex items-center gap-2 text-xs text-text-muted font-sans flex-wrap">
                <span>裁决人：<span className="text-text-secondary">{conflict.decidedBy}</span></span>
                <span>·</span>
                <span>{conflict.status === 'confirmed' ? '确认冲突' : '驳回冲突'}</span>
                <span>·</span>
                <span>
                  {conflict.decidedAt
                    ? new Date(conflict.decidedAt).toLocaleString('zh-CN')
                    : '-'}
                </span>
              </div>
              {conflict.reason && (
                <p className="text-xs text-text-secondary font-sans mt-1.5">理由：{conflict.reason}</p>
              )}
              {conflict.resolvedValue && (
                <p className="text-xs font-sans mt-1.5">
                  裁决后使用值：
                  <code className="font-mono text-text-gold bg-base-800/60 px-1 rounded ml-1">
                    {conflict.resolvedValue}
                  </code>
                </p>
              )}
              {conflict.recalcFinished && calc && (
                <p className="text-xs font-sans mt-1 text-text-green flex items-center gap-1">
                  <CheckCircle size={11} />
                  已自动触发重算 → VaR={calc.displayValue}（v{calc.recalcVersion}）
                </p>
              )}
            </div>
            <div className="bg-base-700/30 rounded-lg p-3 border border-surface-border">
              <p className="text-xs text-text-muted font-sans mb-1">当前 VaR 明细</p>
              {calc && row ? (
                <div className="space-y-0.5 text-xs font-sans">
                  <div>
                    <span className="text-text-muted">原值：</span>
                    <code className="font-mono text-text-secondary">{calc.originalDisplayValue}</code>
                  </div>
                  <div>
                    <span className="text-text-muted">现值：</span>
                    <code className="font-mono text-text-gold">{calc.displayValue}</code>
                  </div>
                  <div>
                    <span className="text-text-muted">版本：</span>
                    <span>v{calc.recalcVersion} · {calc.recalcSource}</span>
                  </div>
                  <div>
                    <span className="text-text-muted">变更次数：</span>
                    <span>{calc.versionHistory.length - 1}</span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-text-muted">无计算明细</p>
              )}
            </div>
          </div>
        )}

        {conflict.status === 'pending' && !showDecision && (
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setShowDecision(true)}
              className="btn-primary flex items-center gap-1.5"
            >
              <MessageSquare size={14} />
              裁决此冲突（必填理由）
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
          <div className="bg-base-700/50 border border-surface-border rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-text-secondary font-sans mb-1">
                  冲突裁决后使用值
                  {conflict.suggestedValue && (
                    <span className="text-accent-amber ml-1">（系统建议）</span>
                  )}
                </label>
                <input
                  value={resolvedValue}
                  onChange={(e) => setResolvedValue(e.target.value)}
                  placeholder="例：99% / 1.7% / 95% 等"
                  className="w-full bg-base-800 border border-surface-border rounded px-3 py-2 text-sm font-mono text-text-primary focus:outline-none focus:border-accent-gold/50"
                />
              </div>
              <div className="space-y-2">
                <label className="block text-xs text-text-secondary font-sans mb-1">
                  裁决操作
                </label>
                <label className="flex items-center gap-2 text-xs text-text-secondary font-sans cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToRow}
                    onChange={(e) => setApplyToRow(e.target.checked)}
                    className="accent-accent-gold"
                  />
                  裁决确认时自动回写到原字段
                  <code className="text-[10px] text-text-gold bg-base-800/60 px-1 rounded ml-1">
                    fields.{conflict.field}
                  </code>
                </label>
                <p className="text-[10px] text-text-muted leading-relaxed">
                  即使回写，
                  <span className="text-accent-amber">
                    原始说法仍保留在 originalFields，不会被清洗
                  </span>
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs text-text-secondary font-sans mb-1">
                裁决理由（必填，将进入审计轨迹）
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="请说明为什么确认/驳回，依据是什么边界值说明，咨询了谁，保留的原始说法是什么..."
                className="w-full bg-base-800 border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary font-sans placeholder-text-muted focus:outline-none focus:border-accent-gold/50 resize-none h-20"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleResolve('confirmed')}
                disabled={!reason.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium border border-accent-green/50 bg-accent-green/10 text-text-green hover:bg-accent-green/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-sans"
              >
                <CheckCircle size={14} />
                确认冲突 → 使用 {resolvedValue || conflict.suggestedValue || '修正值'}
              </button>
              <button
                onClick={() => handleResolve('rejected')}
                disabled={!reason.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded text-sm font-medium border border-accent-red/50 bg-accent-red/10 text-text-red hover:bg-accent-red/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed font-sans"
              >
                <XCircle size={14} />
                驳回冲突（保持原值 {conflict.originalValue}）
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
  const { conflicts, rows, setSelectedRowId } = useVarStore()

  const pendingConflicts = conflicts.filter((c) => c.status === 'pending')
  const resolvedConflicts = conflicts.filter((c) => c.status !== 'pending')
  const mixedFormatRows = rows.filter((r) => r.formatType === 'mixed')
  const unreleasedCount = rows.filter((r) => r.needsReview || r.reviewStatus !== 'released').length

  return (
    <div className="min-h-screen p-6 space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-text-primary font-sans">冲突与复核</h1>
        <p className="text-xs text-text-muted font-sans mt-1">
          原始行 vs 边界值说明逐条对比；百分数/小数混搭绝不自动归正常；裁决→回写→重算→记录 全链路闭环
        </p>
      </header>

      <div className="grid grid-cols-4 gap-4">
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
        <div className="card p-4">
          <div className="text-2xl font-mono text-text-secondary font-bold">{unreleasedCount}</div>
          <div className="text-xs text-text-muted font-sans mt-1">未发布行</div>
        </div>
      </div>

      {pendingConflicts.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-text-red font-sans mb-3 flex items-center gap-2">
            <AlertTriangle size={16} />
            冲突证据列表（裁决 → 回写 → 自动重算）
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
            <FileWarning size={16} />
            待复核队列（百分数/小数混搭 — 绝不自动归正常）
          </h2>
          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-surface-border">
              <span className="text-xs text-text-muted font-sans">
                以下记录存在百分数与小数混搭，
                <span className="text-accent-amber">绝不自动归正常</span>。需活动负责人点击最右「复核」确认。
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
                    <th>格式诊断</th>
                    <th>负责人</th>
                    <th>备注</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {mixedFormatRows.map((row) => {
                    const hasDecimal = /(^|[\s,])0?\.\d+/.test(
                      Object.values(row.fields).join(' ').replace(/[%]/g, '')
                    )
                    const hasPercent = /%/.test(Object.values(row.fields).join(' '))
                    return (
                      <tr key={row.id} className="bg-accent-amber/5">
                        <td className="text-text-muted">{row.rowIndex}</td>
                        <td className="text-text-primary">{row.fields.portfolio}</td>
                        <td>
                          <span className="text-accent-amber font-mono">
                            {row.fields.confidence}
                          </span>
                        </td>
                        <td>
                          <span className="text-accent-amber font-mono">{row.fields.varAmount}</span>
                        </td>
                        <td>
                          <div className="flex flex-col gap-0.5 text-[10px] font-sans">
                            {hasDecimal && <span className="text-text-secondary">含小数表达（如 0.95）</span>}
                            {hasPercent && <span className="text-text-secondary">含百分数表达（如 95%）</span>}
                          </div>
                        </td>
                        <td>
                          <span className="badge-gold">
                            → {row.reviewOwner || '活动负责人'}
                          </span>
                        </td>
                        <td className="max-w-[240px] truncate text-text-secondary text-xs font-sans">
                          {row.remark || '—'}
                        </td>
                        <td>
                          <button
                            onClick={() => setSelectedRowId(row.id)}
                            className="btn-primary text-xs py-1 px-2 flex items-center gap-1"
                          >
                            <Eye size={12} />
                            复核
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {resolvedConflicts.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-text-secondary font-sans mb-3">已裁决记录（可追溯）</h2>
          <div className="space-y-3">
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
