import { X, History, User, ArrowRight, FileCheck, CheckCircle, AlertCircle } from 'lucide-react'
import { useVarStore } from '@/store'
import type { QuestionnaireRow, CalculationDetail } from '@/types'
import { useState } from 'react'

export default function RowDetailDrawer() {
  const {
    selectedRowId,
    setSelectedRowId,
    rows,
    calculations,
    boundaryNotes,
    conflicts,
    applyFieldCorrection,
    recalculate,
    releaseCalculation,
    confirmReview,
  } = useVarStore()

  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editReason, setEditReason] = useState('')
  const [editNextOwner, setEditNextOwner] = useState('')
  const [showReviewConfirm, setShowReviewConfirm] = useState(false)
  const [reviewReason, setReviewReason] = useState('')

  if (!selectedRowId) return null

  const row: QuestionnaireRow | undefined = rows.find((r) => r.id === selectedRowId)
  const calc: CalculationDetail | undefined = calculations.find((c) => c.rowId === selectedRowId)
  const rowConflicts = conflicts.filter((c) => c.rowId === selectedRowId)
  const relatedNotes = boundaryNotes.filter(
    (n) => n.relatedRowIds.includes(selectedRowId) || n.appliedRowIds.includes(selectedRowId)
  )

  if (!row) return null

  const fieldKeys = Object.keys(row.fields)

  const handleSaveEdit = () => {
    if (!editingField || !editValue.trim() || !editReason.trim()) return
    applyFieldCorrection(
      selectedRowId,
      editingField,
      editValue.trim(),
      '唐老师',
      editReason.trim(),
      editNextOwner.trim() || undefined
    )
    setEditingField(null)
    setEditValue('')
    setEditReason('')
    setEditNextOwner('')
  }

  const handleRecalc = () => {
    recalculate(selectedRowId, '唐老师', '手动点击重算')
  }

  const handleRelease = (calcId: string) => {
    releaseCalculation(calcId, '活动负责人')
  }

  const handleConfirmReview = () => {
    if (!reviewReason.trim()) return
    confirmReview(selectedRowId, '活动负责人', reviewReason.trim())
    setShowReviewConfirm(false)
    setReviewReason('')
  }

  const canReview = row.reviewStatus !== 'released' && (row.needsReview || row.formatType === 'mixed')

  return (
    <div className="fixed inset-0 z-[110] flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedRowId(null)} />
      <div className="relative w-[560px] bg-base-800 border-l border-surface-border h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-base-800 z-10 px-6 py-4 border-b border-surface-border flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-text-gold font-sans">
                行 #{row.rowIndex} 复核详情
              </h2>
              {row.needsReview && row.reviewStatus !== 'released' && <span className="badge-gold">待复核</span>}
              {row.reviewStatus === 'reviewing' && <span className="badge-gold">复核中</span>}
              {row.reviewStatus === 'released' && (
                <span className="badge-green">已发布</span>
              )}
              {row.formatType === 'mixed' && row.reviewStatus !== 'released' && (
                <span className="badge-red">格式混搭</span>
              )}
            </div>
            <p className="text-xs text-text-muted font-sans mt-0.5">
              {row.fields.portfolio} · 导入批次 {row.importBatch}
              {row.reviewOwner && ` · 下一步: ${row.reviewOwner}`}
            </p>
          </div>
          <button
            onClick={() => setSelectedRowId(null)}
            className="p-1.5 rounded hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {canReview && !showReviewConfirm && (
            <div className="bg-accent-amber/5 border border-accent-amber/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="text-accent-amber mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-accent-amber font-sans font-medium mb-1">
                    需活动负责人人工复核
                  </p>
                  <p className="text-xs text-text-muted font-sans leading-relaxed mb-3">
                    {row.formatType === 'mixed'
                      ? '此行存在百分数与小数格式混搭，系统不会自动归正常。请人工确认：原始说法保留于 originalFields，改后值已核实，处理原因已记录。'
                      : '此行需人工复核。确认后将同步释放发布，所有关联页面、列表、计算明细、导出将使用此最新结果。'}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setShowReviewConfirm(true)}
                      className="btn-primary text-xs flex items-center gap-1.5"
                    >
                      <CheckCircle size={12} />
                      确认复核完成 → 释放发布
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {showReviewConfirm && (
            <div className="bg-accent-gold/5 border border-accent-gold/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle size={18} className="text-accent-gold mt-0.5 flex-shrink-0" />
                <div className="flex-1 space-y-3">
                  <p className="text-sm text-text-gold font-sans font-medium">
                    确认复核完成（操作人：活动负责人）
                  </p>
                  <p className="text-xs text-text-muted font-sans">
                    确认后：
                    <span className="text-text-secondary">①</span> 此行 reviewStatus 标记为 released
                    <span className="text-text-secondary"> ②</span> needsReview 置为 false
                    <span className="text-text-secondary"> ③</span> 计算明细同步释放发布
                    <span className="text-text-secondary"> ④</span> 所有列表、详情、导出读取此最新状态
                  </p>
                  <div>
                    <label className="block text-xs text-text-secondary font-sans mb-1">
                      复核处理说明（必填，将进入审计轨迹）
                    </label>
                    <textarea
                      value={reviewReason}
                      onChange={(e) => setReviewReason(e.target.value)}
                      placeholder="请说明：原始说法是什么、改后值是什么、处理原因是什么、下一步找谁（已完成则说明）、与谁沟通确认过..."
                      className="w-full bg-base-800 border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary font-sans placeholder-text-muted focus:outline-none focus:border-accent-gold/50 resize-none h-20"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleConfirmReview}
                      disabled={!reviewReason.trim()}
                      className="btn-primary text-xs disabled:opacity-40 flex items-center gap-1.5"
                    >
                      <CheckCircle size={12} />
                      确认复核并释放发布
                    </button>
                    <button
                      onClick={() => {
                        setShowReviewConfirm(false)
                        setReviewReason('')
                      }}
                      className="btn-ghost text-xs"
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {row.reviewStatus === 'released' && row.reviewedBy && (
            <div className="bg-accent-green/5 border border-accent-green/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle size={18} className="text-accent-green mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-text-green font-sans font-medium mb-1">
                    已人工复核通过并发布
                  </p>
                  <div className="text-xs text-text-secondary font-sans space-y-0.5">
                    <p>
                      <span className="text-text-muted">复核人：</span>
                      {row.reviewedBy}
                    </p>
                    {row.reviewedAt && (
                      <p>
                        <span className="text-text-muted">复核时间：</span>
                        {new Date(row.reviewedAt).toLocaleString('zh-CN')}
                      </p>
                    )}
                    {row.reviewReason && (
                      <p>
                        <span className="text-text-muted">复核说明：</span>
                        {row.reviewReason}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          <section>
            <h3 className="text-sm font-medium text-text-primary font-sans mb-3 flex items-center gap-2">
              <FileCheck size={14} className="text-accent-gold" />
              原始问卷行 vs 修正值
            </h3>
            <div className="card divide-y divide-surface-border/60">
              {fieldKeys.map((fk) => {
                const original = row.originalFields[fk]
                const current = row.fields[fk]
                const changed = original !== current
                return (
                  <div key={fk} className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-mono text-text-gold">{fk}</span>
                      {changed && <span className="badge-gold">已修正</span>}
                      {!editingField && row.reviewStatus !== 'released' && (
                        <button
                          onClick={() => {
                            setEditingField(fk)
                            setEditValue(current)
                          }}
                          className="text-[10px] text-text-muted hover:text-text-gold transition-colors"
                        >
                          修正
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-base-700/50 rounded px-3 py-2">
                        <div className="text-[10px] text-text-muted mb-0.5">原始说法</div>
                        <div className="font-mono text-text-secondary">{original}</div>
                      </div>
                      <div className={`rounded px-3 py-2 ${changed ? 'bg-accent-green/10 border border-accent-green/30' : 'bg-base-700/50'}`}>
                        <div className={`text-[10px] mb-0.5 ${changed ? 'text-text-green' : 'text-text-muted'}`}>
                          {changed ? '改后值' : '当前值'}
                        </div>
                        <div className={`font-mono ${changed ? 'text-text-green' : 'text-text-primary'}`}>
                          {current}
                        </div>
                      </div>
                    </div>
                    {editingField === fk && (
                      <div className="mt-3 bg-base-700/50 border border-surface-border rounded p-3 space-y-2">
                        <div>
                          <label className="text-[10px] text-text-muted">新值</label>
                          <input
                            className="w-full bg-base-800 border border-surface-border rounded px-3 py-1.5 text-sm font-mono text-text-primary focus:outline-none focus:border-accent-gold/50"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-text-muted">处理原因（必填）</label>
                          <input
                            className="w-full bg-base-800 border border-surface-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-gold/50"
                            value={editReason}
                            onChange={(e) => setEditReason(e.target.value)}
                            placeholder="说明为什么改、依据什么规则"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-text-muted">下一步处理人（可选）</label>
                          <select
                            className="w-full bg-base-800 border border-surface-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-gold/50"
                            value={editNextOwner}
                            onChange={(e) => setEditNextOwner(e.target.value)}
                          >
                            <option value="">保留当前</option>
                            <option value="活动负责人">活动负责人（最终确认）</option>
                            <option value="唐老师">竞赛教练唐老师</option>
                          </select>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            disabled={!editReason.trim() || !editValue.trim()}
                            onClick={handleSaveEdit}
                            className="btn-primary text-xs disabled:opacity-40"
                          >
                            保存修正
                          </button>
                          <button
                            onClick={() => {
                              setEditingField(null)
                              setEditValue('')
                              setEditReason('')
                              setEditNextOwner('')
                            }}
                            className="btn-ghost text-xs"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-medium text-text-primary font-sans mb-3">
              边界值说明备注
            </h3>
            <div className="space-y-2">
              {relatedNotes.length === 0 && (
                <p className="text-xs text-text-muted font-sans p-3 border border-dashed border-surface-border rounded">
                  暂无相关边界值说明
                </p>
              )}
              {relatedNotes.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 rounded-lg border ${
                    n.appliedRowIds.includes(row.id)
                      ? 'border-accent-green/30 bg-accent-green/5'
                      : 'border-accent-amber/30 bg-accent-amber/5'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-text-gold">#{n.id} {n.fieldName}</span>
                    {n.appliedRowIds.includes(row.id) ? (
                      <span className="badge-green">已生效</span>
                    ) : (
                      <span className="badge-gold">待确认</span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary font-sans leading-relaxed whitespace-pre-wrap">
                    {n.originalText}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-medium text-text-primary font-sans mb-3">冲突与裁决</h3>
            <div className="space-y-2">
              {rowConflicts.length === 0 && (
                <p className="text-xs text-text-muted font-sans p-3 border border-dashed border-surface-border rounded">
                  无冲突记录
                </p>
              )}
              {rowConflicts.map((c) => (
                <div
                  key={c.id}
                  className={`p-4 rounded-lg border ${
                    c.status === 'pending'
                      ? 'border-accent-red/30 bg-accent-red/5'
                      : 'border-surface-border bg-base-700/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-text-gold">
                      #{c.id} {c.field}
                    </span>
                    {c.status === 'pending' && <span className="badge-red">待裁决</span>}
                    {c.status === 'confirmed' && <span className="badge-green">已确认</span>}
                    {c.status === 'rejected' && <span className="badge-muted">已驳回</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div>
                      <div className="text-[10px] text-text-muted">原始值</div>
                      <div className="font-mono text-accent-amber">{c.originalValue}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-text-muted">边界值要求</div>
                      <div className="font-sans text-accent-red">{c.boundaryValue}</div>
                    </div>
                  </div>
                  {c.status !== 'pending' && (
                    <div className="text-[11px] text-text-secondary font-sans border-t border-surface-border/50 pt-2 space-y-0.5">
                      <div>
                        <span className="text-text-muted">裁决人：</span>
                        {c.decidedBy}
                        <span className="text-text-muted"> · 裁决值：</span>
                        <span className="font-mono text-text-green">{c.resolvedValue || '—'}</span>
                      </div>
                      <div>
                        <span className="text-text-muted">理由：</span>
                        {c.reason}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-text-primary font-sans">VaR 计算明细</h3>
              <div className="flex items-center gap-2">
                <button onClick={handleRecalc} className="btn-primary text-xs py-1">
                  重算此行
                </button>
                {calc && !calc.released && row.reviewStatus === 'released' && (
                  <button
                    onClick={() => handleRelease(calc.id)}
                    className="btn-primary text-xs py-1"
                  >
                    释放发布
                  </button>
                )}
                {calc && !calc.released && row.reviewStatus !== 'released' && !row.needsReview && row.formatType !== 'mixed' && (
                  <button
                    onClick={() => handleRelease(calc.id)}
                    className="btn-primary text-xs py-1"
                  >
                    释放发布
                  </button>
                )}
              </div>
            </div>
            {!calc && (
              <p className="text-xs text-text-muted font-sans p-3 border border-dashed border-surface-border rounded">
                无计算明细（可能重复导入未触发计算）
              </p>
            )}
            {calc && (
              <div className="card p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="bg-base-700/50 rounded p-3">
                    <div className="text-[10px] text-text-muted">原值 v{calc.versionHistory[0]?.version}</div>
                    <div className="font-mono text-text-secondary">
                      {calc.versionHistory[0]?.displayValue}
                    </div>
                    <div className="text-[10px] text-text-muted mt-0.5">
                      {calc.versionHistory[0]?.source} · {calc.versionHistory[0]?.updatedBy}
                    </div>
                  </div>
                  <div className="bg-accent-gold/10 border border-accent-gold/30 rounded p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-[10px] text-text-gold">当前值 v{calc.recalcVersion}</div>
                      {calc.released ? <span className="badge-green">已发布</span> : <span className="badge-gold">草稿</span>}
                    </div>
                    <div className="font-mono text-text-gold text-base">{calc.displayValue}</div>
                    <div className="text-[10px] text-text-muted mt-0.5">
                      {calc.recalcSource} · {calc.updatedBy}
                    </div>
                    {calc.releasedAt && (
                      <div className="text-[10px] text-accent-green mt-0.5">
                        发布于 {new Date(calc.releasedAt).toLocaleString('zh-CN')}
                        {calc.releasedBy && ` · ${calc.releasedBy}`}
                      </div>
                    )}
                  </div>
                </div>
                {calc.versionHistory.length > 1 && (
                  <div className="border-t border-surface-border/50 pt-3">
                    <p className="text-[11px] text-text-muted mb-2 flex items-center gap-1">
                      <History size={11} />
                      版本历史（{calc.versionHistory.length} 版）
                    </p>
                    <div className="space-y-1 max-h-[180px] overflow-y-auto">
                      {[...calc.versionHistory].reverse().map((v) => (
                        <div
                          key={v.version}
                          className="flex items-center gap-2 text-[11px] bg-base-700/40 rounded px-2 py-1.5"
                        >
                          <span className="badge-muted w-10 shrink-0">v{v.version}</span>
                          <ArrowRight size={10} className="text-text-muted shrink-0" />
                          <span className="font-mono text-text-primary shrink-0">{v.displayValue}</span>
                          <span className="text-text-muted truncate flex-1">
                            {v.source}
                          </span>
                          <span className="text-text-muted shrink-0 font-sans">{v.updatedBy}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-sm font-medium text-text-primary font-sans mb-3 flex items-center gap-2">
              <User size={14} className="text-accent-gold" />
              变更与审计轨迹（此行）
            </h3>
            <div className="relative pl-4 space-y-2">
              <div className="absolute left-[11px] top-1 bottom-1 w-px bg-surface-border" />
              {row.valueChanges.length === 0 && rowConflicts.length === 0 && !row.reviewedBy && (
                <p className="text-xs text-text-muted font-sans p-2">暂无变更记录</p>
              )}
              {row.reviewedBy && row.reviewReason && (
                <div className="relative">
                  <div className="absolute -left-[9px] top-1 w-2.5 h-2.5 rounded-full bg-accent-green border-2 border-base-800" />
                  <div className="text-[11px] bg-base-700/40 rounded px-2 py-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-text-green">复核确认并发布</span>
                    </div>
                    <div className="mt-0.5 text-text-muted font-sans flex items-center gap-1 flex-wrap">
                      <span>{row.reviewedBy}</span>
                      <span>· {row.reviewedAt ? new Date(row.reviewedAt).toLocaleString('zh-CN') : ''}</span>
                    </div>
                    <div className="text-[10px] text-text-secondary mt-0.5 font-sans">
                      复核说明：{row.reviewReason}
                    </div>
                  </div>
                </div>
              )}
              {row.valueChanges.map((vc, i) => (
                <div key={i} className="relative">
                  <div className="absolute -left-[9px] top-1 w-2.5 h-2.5 rounded-full bg-accent-gold border-2 border-base-800" />
                  <div className="text-[11px] bg-base-700/40 rounded px-2 py-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-text-gold font-mono">{vc.field}</span>
                      <span className="text-text-muted">
                        <span className="font-mono text-accent-amber">{vc.before}</span>
                        <ArrowRight size={9} className="inline mx-0.5" />
                        <span className="font-mono text-text-green">{vc.after}</span>
                      </span>
                    </div>
                    <div className="mt-0.5 text-text-muted font-sans flex items-center gap-1 flex-wrap">
                      <span>{vc.operator}</span>
                      <span>· {new Date(vc.timestamp).toLocaleString('zh-CN')}</span>
                      {vc.nextOwner && (
                        <span className="ml-auto text-accent-amber">→ 下一步: {vc.nextOwner}</span>
                      )}
                    </div>
                    <div className="text-[10px] text-text-secondary mt-0.5 font-sans">
                      原因：{vc.reason}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
