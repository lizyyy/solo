import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useAppStore } from '../store/AppStore'
import { StatusBadge, ShiftBadge, SourceBadge, formatDateTime } from './StatusBadge'
import type { MetricValue, PartInfo, PumpStatus } from '../types'
import { DEFAULT_THRESHOLD, METRIC_LABELS, METRIC_UNITS, CALC_FORMULA_NOTES, THRESHOLD_VERSION } from '../data/thresholds'
import clsx from 'clsx'
import {
  X, Edit3, Check, XCircle, RefreshCw, FilePlus, ImagePlus, AlertTriangle,
  GitBranch, MessageSquare, Camera, ThumbsUp, ChevronDown, ChevronUp, Trash2,
  User, Clock, Eye, ShieldAlert, Link as LinkIcon, TrendingUp,
} from 'lucide-react'
import { RerunModal } from './RerunModal'

export const InspectionDetail: React.FC = () => {
  const {
    inspections, changes, notes, screenshots, selectedInspectionId, setSelectedInspectionId,
    highlightAlertMetric, setHighlightAlertMetric,
    updateMetric, updateStatus, updateCalcNotes, updatePart, confirmPartReplace,
    addNote, addScreenshot, getHistoryChain, getHistoryChainIds, currentUser,
  } = useAppStore()

  const inspection = inspections.find((i) => i.id === selectedInspectionId)
  const [editingMetric, setEditingMetric] = useState<keyof MetricValue | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editReason, setEditReason] = useState('')
  const [editingCalcNotes, setEditingCalcNotes] = useState(false)
  const [calcNotesDraft, setCalcNotesDraft] = useState('')
  const [noteDraft, setNoteDraft] = useState('')
  const [noteJudgments, setNoteJudgments] = useState('')
  const [showHistory, setShowHistory] = useState(true)
  const [showRerunModal, setShowRerunModal] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const historyChain = useMemo(
    () => (selectedInspectionId ? getHistoryChain(selectedInspectionId) : []),
    [selectedInspectionId, getHistoryChain]
  )
  const historyChainIds = useMemo(
    () => (selectedInspectionId ? getHistoryChainIds(selectedInspectionId) : []),
    [selectedInspectionId, getHistoryChainIds]
  )
  const relatedChanges = useMemo(
    () => changes.filter((c) => historyChainIds.includes(c.inspectionId)).sort((a, b) => b.changeTime.localeCompare(a.changeTime)),
    [changes, historyChainIds]
  )
  const relatedNotes = useMemo(
    () => notes.filter((n) => historyChainIds.includes(n.inspectionId)).sort((a, b) => b.createTime.localeCompare(a.createTime)),
    [notes, historyChainIds]
  )
  const relatedShots = useMemo(
    () => screenshots.filter((s) => historyChainIds.includes(s.inspectionId)),
    [screenshots, historyChainIds]
  )

  const ownNotes = useMemo(
    () => notes.filter((n) => n.inspectionId === selectedInspectionId).sort((a, b) => b.createTime.localeCompare(a.createTime)),
    [notes, selectedInspectionId]
  )
  const inheritedNotes = useMemo(
    () => notes.filter((n) => n.inspectionId !== selectedInspectionId && historyChainIds.includes(n.inspectionId)).sort((a, b) => b.createTime.localeCompare(a.createTime)),
    [notes, selectedInspectionId, historyChainIds]
  )
  const ownShots = useMemo(
    () => screenshots.filter((s) => s.inspectionId === selectedInspectionId),
    [screenshots, selectedInspectionId]
  )
  const inheritedShots = useMemo(
    () => screenshots.filter((s) => s.inspectionId !== selectedInspectionId && historyChainIds.includes(s.inspectionId)),
    [screenshots, selectedInspectionId, historyChainIds]
  )
  const ownChanges = useMemo(
    () => changes.filter((c) => c.inspectionId === selectedInspectionId).sort((a, b) => b.changeTime.localeCompare(a.changeTime)),
    [changes, selectedInspectionId]
  )
  const inheritedChanges = useMemo(
    () => changes.filter((c) => c.inspectionId !== selectedInspectionId && historyChainIds.includes(c.inspectionId)).sort((a, b) => b.changeTime.localeCompare(a.changeTime)),
    [changes, selectedInspectionId, historyChainIds]
  )

  useEffect(() => {
    if (highlightAlertMetric) {
      setEditingMetric(highlightAlertMetric as keyof MetricValue)
    }
  }, [highlightAlertMetric])

  if (!inspection) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-400">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
          <Eye className="w-7 h-7 text-slate-300" />
        </div>
        <p className="text-sm">从左侧选择一条巡检记录查看详情</p>
        <p className="text-xs text-slate-300 mt-1">点击预警图表的异常点也会自动打开对应记录</p>
      </div>
    )
  }

  const startEditMetric = (k: keyof MetricValue) => {
    setEditingMetric(k)
    setEditValue(String(inspection.metrics[k]))
    setEditReason('')
  }
  const saveMetric = () => {
    if (!editingMetric) return
    const num = Number(editValue)
    if (Number.isNaN(num)) return
    updateMetric(inspection.id, editingMetric, num, editReason || undefined)
    setEditingMetric(null)
    setHighlightAlertMetric(null)
  }
  const saveCalcNotes = () => {
    updateCalcNotes(inspection.id, calcNotesDraft, '更新计算口径备注')
    setEditingCalcNotes(false)
  }
  const submitNote = () => {
    if (!noteDraft.trim()) return
    const j = noteJudgments.split(/\n/).map((s) => s.trim()).filter(Boolean)
    addNote(inspection.id, noteDraft, j)
    setNoteDraft('')
    setNoteJudgments('')
  }
  const handleFile = (f: File | undefined) => {
    if (f) addScreenshot(inspection.id, f, `用户上传：${f.name}`)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-200 bg-white flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900 truncate">{inspection.pumpName}</h2>
              <StatusBadge status={inspection.status} />
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
              <span className="font-mono">{inspection.id}</span>
              <span>·</span>
              <SourceBadge source={inspection.source} />
              <ShiftBadge shift={inspection.shift} />
              <span>·</span>
              <span>{inspection.inspectionDate}</span>
              <span>·</span>
              <span>巡检人：{inspection.inspector}</span>
              {inspection.parentId && (
                <>
                  <span>·</span>
                  <button
                    onClick={() => setSelectedInspectionId(inspection.parentId!)}
                    className="inline-flex items-center gap-0.5 text-brand-600 hover:text-brand-700"
                  >
                    <GitBranch className="w-3 h-3" />父记录
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRerunModal(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md bg-violet-50 text-violet-700 hover:bg-violet-100 border border-violet-200 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />补录 / 重跑
          </button>
          <button
            onClick={() => setSelectedInspectionId(null)}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto scroll-thin">
        {historyChain.length > 1 && (
          <div className="px-5 pt-4">
            <div className="bg-white rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                  <GitBranch className="w-4 h-4 text-violet-500" />
                  历史链路（{historyChain.length} 条，补录/重跑后连续检查）
                </div>
                <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                  ✓ 历史未断档
                </span>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto scroll-thin pb-1">
                {historyChain.map((h, idx) => (
                  <React.Fragment key={h.id}>
                    <button
                      onClick={() => setSelectedInspectionId(h.id)}
                      className={clsx('shrink-0 px-3 py-2 rounded-md text-left border min-w-[180px] transition',
                        h.id === inspection.id
                          ? 'bg-brand-50 border-brand-300 ring-2 ring-brand-200'
                          : 'bg-slate-50 border-slate-200 hover:border-brand-300 hover:bg-brand-50/50'
                      )}
                    >
                      <div className="text-xs font-mono text-slate-500">{h.id}</div>
                      <div className="text-sm font-medium text-slate-700 mt-0.5 flex items-center gap-1">
                        <SourceBadge source={h.source} />
                        {h.rerunCount > 0 && <span className="text-[10px] text-violet-600">第{h.rerunCount}次</span>}
                      </div>
                      <div className="mt-1"><StatusBadge status={h.status} /></div>
                    </button>
                    {idx < historyChain.length - 1 && (
                      <div className="shrink-0 text-slate-300">→</div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="p-5 space-y-5">
          {inspection.rerunDelta && (
            <section className="bg-gradient-to-r from-violet-50 to-brand-50 rounded-lg border border-violet-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-violet-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-violet-800 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" />
                  本次{inspection.source === 'supplement' ? '补录' : '重跑'}对比 · 与父记录 {inspection.parentId} 的变化
                </h3>
                <span className="text-[11px] text-violet-500 bg-white/60 px-2 py-0.5 rounded">
                  口径 {inspection.calcFormulaVersion}
                </span>
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-white/70 rounded-lg p-3 border border-violet-100">
                    <div className="text-[11px] text-violet-500 mb-1">状态变化</div>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={inspection.rerunDelta.oldStatus} />
                      <span className="text-slate-400">→</span>
                      <StatusBadge status={inspection.rerunDelta.newStatus} />
                    </div>
                    <div className="text-[10px] mt-1 text-slate-500">
                      {inspection.rerunDelta.statusChanged ? '状态已变更' : '状态未变'}
                    </div>
                  </div>
                  <div className="bg-white/70 rounded-lg p-3 border border-violet-100">
                    <div className="text-[11px] text-violet-500 mb-1">新增异常</div>
                    <div className="text-lg font-bold text-amber-600">
                      {inspection.rerunDelta.addedAlerts.length}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                      {inspection.rerunDelta.addedAlerts.length > 0
                        ? inspection.rerunDelta.addedAlerts.join('、')
                        : '无新增'}
                    </div>
                  </div>
                  <div className="bg-white/70 rounded-lg p-3 border border-violet-100">
                    <div className="text-[11px] text-violet-500 mb-1">消除异常</div>
                    <div className="text-lg font-bold text-emerald-600">
                      {inspection.rerunDelta.removedAlerts.length}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                      {inspection.rerunDelta.removedAlerts.length > 0
                        ? inspection.rerunDelta.removedAlerts.join('、')
                        : '无消除'}
                    </div>
                  </div>
                  <div className="bg-white/70 rounded-lg p-3 border border-violet-100">
                    <div className="text-[11px] text-violet-500 mb-1">继承链路内容</div>
                    <div className="text-xs text-slate-700 space-y-0.5">
                      <div>备注 {inspection.rerunDelta.notesInherited} 条</div>
                      <div>截图 {inspection.rerunDelta.screenshotsInherited} 张</div>
                      <div>变更 {inspection.rerunDelta.changesInherited} 条</div>
                    </div>
                  </div>
                </div>

                {inspection.rerunDelta.changedMetrics.length > 0 && (
                  <div className="bg-white/70 rounded-lg p-3 border border-violet-100">
                    <div className="text-[11px] text-violet-500 mb-2">指标变化明细</div>
                    <div className="flex flex-wrap gap-1.5">
                      {inspection.rerunDelta.changedMetrics.map((m, idx) => (
                        <span key={idx} className="text-[11px] bg-white text-slate-700 px-2 py-0.5 rounded border border-slate-200">
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-brand-600" />
                巡检指标 · 点击可修改（修改会进入变更历史）
              </h3>
              <span className="text-xs text-slate-400">口径版本 {THRESHOLD_VERSION}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-slate-100">
              {(Object.keys(METRIC_LABELS) as (keyof MetricValue)[]).map((k) => {
                const val = inspection.metrics[k]
                const alert = inspection.alerts.find((a) => a.metric === k)
                const t = DEFAULT_THRESHOLD[k]
                const pct = Math.min(100, Math.max(0, ((val - t.min) / (t.max - t.min)) * 100))
                const editing = editingMetric === k
                return (
                  <div key={k} className={clsx('bg-white p-4', {
                    'ring-2 ring-amber-300 bg-amber-50/50': highlightAlertMetric === k,
                  })}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="text-xs text-slate-500">{METRIC_LABELS[k]}</div>
                        <div className="text-xs text-slate-400 mt-0.5">范围 {t.min} ~ {t.max} {METRIC_UNITS[k]}</div>
                      </div>
                      {alert ? (
                        <span className={clsx('inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium',
                          alert.level === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700')}>
                          <AlertTriangle className="w-3 h-3" />
                          {alert.level === 'critical' ? '超限' : '预警'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-600">
                          ✓ 正常
                        </span>
                      )}
                    </div>
                    {editing ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            type="number"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-full px-2 py-1.5 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-400 tabular-nums"
                          />
                          <button onClick={saveMetric} className="p-1.5 rounded-md bg-emerald-500 text-white hover:bg-emerald-600"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => { setEditingMetric(null); setHighlightAlertMetric(null) }} className="p-1.5 rounded-md bg-slate-100 text-slate-500 hover:bg-slate-200"><XCircle className="w-3.5 h-3.5" /></button>
                        </div>
                        <input
                          value={editReason}
                          onChange={(e) => setEditReason(e.target.value)}
                          placeholder="修改原因（必填，交接班可查）"
                          className="w-full px-2 py-1.5 text-xs rounded-md border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-brand-300"
                        />
                        {alert && <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded">判定公式：{alert.formula}</div>}
                      </div>
                    ) : (
                      <button onClick={() => startEditMetric(k)} className="text-left w-full group">
                        <div className="flex items-baseline gap-1">
                          <span className={clsx('text-2xl font-semibold tabular-nums', {
                            'text-red-600': alert?.level === 'critical',
                            'text-amber-600': alert?.level === 'warning',
                            'text-slate-800': !alert,
                          })}>{val}</span>
                          <span className="text-xs text-slate-400">{METRIC_UNITS[k]}</span>
                          <Edit3 className="w-3 h-3 ml-auto text-slate-300 group-hover:text-brand-500" />
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={clsx('h-full rounded-full transition-all', {
                              'bg-red-500': alert?.level === 'critical',
                              'bg-amber-500': alert?.level === 'warning',
                              'bg-emerald-500': !alert,
                            })}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <section className="bg-white rounded-lg border border-slate-200">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                  <FilePlus className="w-4 h-4 text-brand-600" />
                  计算口径与备注
                </h3>
                <button
                  onClick={() => { setEditingCalcNotes(true); setCalcNotesDraft(inspection.calcNotes) }}
                  className="text-xs text-brand-600 hover:text-brand-700 inline-flex items-center gap-0.5"
                >
                  <Edit3 className="w-3 h-3" />修改
                </button>
              </div>
              <div className="p-4 space-y-3 text-sm">
                <div className="grid grid-cols-4 gap-2 text-xs">
                  <div className="bg-slate-50 rounded p-2">
                    <div className="text-slate-400">口径版本</div>
                    <div className="text-slate-700 font-mono mt-0.5">{inspection.calcFormulaVersion}</div>
                  </div>
                  <div className="bg-slate-50 rounded p-2 col-span-3">
                    <div className="text-slate-400">本条备注（修改会进入变更历史）</div>
                    {editingCalcNotes ? (
                      <div className="mt-1 space-y-1.5">
                        <textarea
                          value={calcNotesDraft}
                          onChange={(e) => setCalcNotesDraft(e.target.value)}
                          rows={3}
                          className="w-full px-2 py-1.5 text-xs rounded border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-400"
                        />
                        <div className="flex items-center gap-1.5">
                          <button onClick={saveCalcNotes} className="px-2 py-1 text-xs rounded bg-brand-600 text-white hover:bg-brand-700">保存</button>
                          <button onClick={() => setEditingCalcNotes(false)} className="px-2 py-1 text-xs rounded bg-slate-100 text-slate-500 hover:bg-slate-200">取消</button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-slate-700 mt-0.5 leading-relaxed">{inspection.calcNotes}</div>
                    )}
                  </div>
                </div>
                <pre className="text-[11px] leading-relaxed bg-slate-50 text-slate-500 p-3 rounded whitespace-pre-wrap border border-slate-100">
{CALC_FORMULA_NOTES.trim()}
                </pre>
              </div>
            </section>

            <section className="bg-white rounded-lg border border-slate-200">
              <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-brand-600" />
                  巡检表备注（必须说明改变了哪些判断）
                </h3>
                <span className="text-[11px] text-slate-400">本次 {ownNotes.length} 条 · 继承 {inheritedNotes.length} 条</span>
              </div>
              <div className="p-4 space-y-4">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
                  <div className="text-xs text-slate-500 mb-2 font-medium">📝 添加本次备注</div>
                  <textarea
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    rows={2}
                    placeholder="写一条备注（周一早会临时补充、异常判定说明等）…"
                    className="w-full px-2 py-1.5 text-sm rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                  />
                  <textarea
                    value={noteJudgments}
                    onChange={(e) => setNoteJudgments(e.target.value)}
                    rows={3}
                    placeholder="本条备注改变了哪些判断？每行写一条，例如：&#10;振动从“正常区间”调整为“预警跟踪”&#10;巡检建议从4h加密为2h"
                    className="mt-2 w-full px-2 py-1.5 text-xs rounded-md border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">· 改变的判断会被显式记录，交接时一眼看清</span>
                    <button
                      onClick={submitNote}
                      disabled={!noteDraft.trim()}
                      className="inline-flex items-center gap-1 px-3 py-1 text-xs rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400"
                    >
                      <Check className="w-3 h-3" /> 提交备注
                    </button>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 mb-2 font-medium flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-brand-400" />
                    本次记录备注（{ownNotes.length} 条）
                  </div>
                  <div className="space-y-2">
                    {ownNotes.length === 0 && <div className="text-xs text-slate-400 py-2 text-center border border-dashed border-slate-200 rounded">暂无本次备注</div>}
                    {ownNotes.map((n) => (
                      <div key={n.id} className="border border-brand-100 rounded-lg p-3 bg-brand-50/30">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <User className="w-3 h-3" /><span className="font-medium text-slate-700">{n.author}</span>
                            <span className="text-slate-400">·</span><span>{n.authorRole}</span>
                            <span className="text-slate-400">·</span>
                            <Clock className="w-3 h-3" /><span>{formatDateTime(n.createTime)}</span>
                          </div>
                          {n.screenshotRefs && n.screenshotRefs.length > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
                              <Camera className="w-3 h-3" />关联截图 {n.screenshotRefs.length}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-800 leading-relaxed">{n.content}</p>
                        {n.affectedJudgments.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {n.affectedJudgments.map((j, idx) => (
                              <li key={idx} className="text-xs text-violet-700 bg-violet-50 rounded px-2 py-1 inline-flex items-start gap-1.5 mr-1 mb-1">
                                <span className="text-violet-400 mt-0.5">◆</span>
                                <span>{j}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {inheritedNotes.length > 0 && (
                  <div>
                    <div className="text-xs text-slate-500 mb-2 font-medium flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-violet-300" />
                      继承自链路历史备注（{inheritedNotes.length} 条 · 来自父记录及更早）
                    </div>
                    <div className="space-y-2">
                      {inheritedNotes.map((n) => (
                        <div key={n.id} className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 opacity-80">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <User className="w-3 h-3" /><span className="font-medium text-slate-700">{n.author}</span>
                              <span className="text-slate-400">·</span><span>{n.authorRole}</span>
                              <span className="text-slate-400">·</span>
                              <Clock className="w-3 h-3" /><span>{formatDateTime(n.createTime)}</span>
                            </div>
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">
                              <LinkIcon className="w-3 h-3" />{n.inspectionId}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed">{n.content}</p>
                          {n.affectedJudgments.length > 0 && (
                            <ul className="mt-2 space-y-1">
                              {n.affectedJudgments.map((j, idx) => (
                                <li key={idx} className="text-xs text-violet-600 bg-violet-50/70 rounded px-2 py-1 inline-flex items-start gap-1.5 mr-1 mb-1">
                                  <span className="text-violet-400 mt-0.5">◆</span>
                                  <span>{j}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>

          <section className="bg-white rounded-lg border border-slate-200">
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-brand-600" />
                截图说明（与备注/状态关联，断线可追踪）
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">本次 {ownShots.length} 张 · 继承 {inheritedShots.length} 张</span>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0] ?? undefined)} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-600"
                >
                  <ImagePlus className="w-3 h-3" />上传截图
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <div className="text-xs text-slate-500 mb-2 font-medium flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-brand-400" />
                  本次记录截图（{ownShots.length} 张）
                </div>
                {ownShots.length === 0 ? (
                  <div className="text-xs text-slate-400 py-3 text-center border border-dashed border-slate-200 rounded">
                    暂无本次截图
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {ownShots.map((s) => (
                      <figure key={s.id} className="rounded-lg border border-brand-200 overflow-hidden bg-brand-50/30">
                        <div className="aspect-video overflow-hidden bg-white">
                          <img src={s.dataUrl} alt={s.name} className="w-full h-full object-contain" />
                        </div>
                        <figcaption className="p-2 border-t border-slate-100 bg-white">
                          <div className="text-xs font-medium text-slate-700 truncate">{s.name}</div>
                          {s.description && <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{s.description}</div>}
                          <div className="text-[10px] text-slate-400 mt-1">{formatDateTime(s.uploadTime)}</div>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </div>

              {inheritedShots.length > 0 && (
                <div>
                  <div className="text-xs text-slate-500 mb-2 font-medium flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-violet-300" />
                    继承自链路截图（{inheritedShots.length} 张 · 来自父记录及更早）
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {inheritedShots.map((s) => (
                      <figure key={s.id} className="rounded-lg border border-slate-200 overflow-hidden bg-slate-50 opacity-80">
                        <div className="aspect-video overflow-hidden bg-white">
                          <img src={s.dataUrl} alt={s.name} className="w-full h-full object-contain" />
                        </div>
                        <figcaption className="p-2 border-t border-slate-100 bg-white">
                          <div className="text-xs font-medium text-slate-700 truncate">{s.name}</div>
                          <div className="text-[10px] text-violet-600 mt-0.5">来自 {s.inspectionId}</div>
                          {s.description && <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{s.description}</div>}
                          <div className="text-[10px] text-slate-400 mt-1">{formatDateTime(s.uploadTime)}</div>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="bg-white rounded-lg border border-slate-200">
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-violet-600" />
                备件登记 · 型号替换自动挂起（不做假稳定结论）
              </h3>
              <span className="text-[11px] text-slate-400">{inspection.parts.filter((p) => p.replaced && !p.confirmedBy).length} 项待确认</span>
            </div>
            <div className="p-4 space-y-2">
              {inspection.parts.map((p, idx) => {
                const hasUnconfirmedReplace = p.replaced && !p.confirmedBy
                return (
                  <div key={idx} className={clsx('border rounded-lg p-3 transition',
                    hasUnconfirmedReplace ? 'border-violet-300 bg-violet-50/40 ring-1 ring-violet-200' : 'border-slate-200 bg-white')}>
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-800">{p.name}</span>
                          {p.replaced && <span className="text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">已替换</span>}
                          {p.confirmedBy && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                            <ThumbsUp className="w-2.5 h-2.5" />运营主管已确认
                          </span>}
                          {hasUnconfirmedReplace && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5">
                            <AlertTriangle className="w-2.5 h-2.5" />待运营主管确认，不做稳定结论
                          </span>}
                        </div>
                        <div className="text-xs text-slate-600 flex items-center gap-3 flex-wrap">
                          {p.originalModel && p.newModel ? (
                            <>
                              <span>原型号：<code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{p.originalModel}</code></span>
                              <span>→</span>
                              <span>新型号：<code className="bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">{p.newModel}</code></span>
                            </>
                          ) : (
                            <span>型号：<code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{p.model}</code></span>
                          )}
                          {p.replaceTime && <span className="text-slate-400">替换于 {formatDateTime(p.replaceTime)}</span>}
                          {p.confirmedBy && p.confirmedAt && <span className="text-slate-400">确认：{p.confirmedBy} @ {formatDateTime(p.confirmedAt)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            const newModel = prompt('输入替换后的新型号（原型号将保留对比）：', p.model)
                            if (!newModel || newModel === p.model) return
                            updatePart(
                              inspection.id, idx,
                              {
                                replaced: true,
                                model: newModel,
                                originalModel: p.originalModel ?? p.model,
                                newModel,
                                replaceTime: new Date().toISOString(),
                                confirmedBy: undefined,
                                confirmedAt: undefined,
                              } as PartInfo,
                              `备件${p.name}型号替换：${p.model} → ${newModel}，已挂起待主管确认`
                            )
                          }}
                          className="text-xs px-2 py-1 rounded-md bg-white border border-slate-200 hover:border-brand-400 hover:text-brand-700 transition"
                        >
                          替换型号
                        </button>
                        {hasUnconfirmedReplace && (
                          <button
                            onClick={() => {
                              const name = prompt('运营主管姓名：', '李总（运营主管）')
                              if (!name) return
                              confirmPartReplace(inspection.id, idx, name)
                            }}
                            className="text-xs px-2 py-1 rounded-md bg-violet-600 text-white hover:bg-violet-700 transition inline-flex items-center gap-0.5"
                          >
                            <ThumbsUp className="w-3 h-3" />主管确认
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="bg-white rounded-lg border border-slate-200">
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between cursor-pointer" onClick={() => setShowHistory((s) => !s)}>
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                <GitBranch className="w-4 h-4 text-brand-600" />
                变更历史（交接班必看：上一班改了什么、为什么改）
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">本次 {ownChanges.length} 条 · 继承 {inheritedChanges.length} 条</span>
                {showHistory ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </div>
            {showHistory && (
              <div className="p-4 space-y-4">
                <div>
                  <div className="text-xs text-slate-500 mb-2 font-medium flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-brand-400" />
                    本次记录变更（{ownChanges.length} 条）
                  </div>
                  {ownChanges.length === 0 ? (
                    <div className="text-xs text-slate-400 py-2 text-center border border-dashed border-slate-200 rounded">暂无本次变更</div>
                  ) : (
                    <ol className="relative border-l border-brand-200 ml-2 space-y-3">
                      {ownChanges.map((c) => (
                        <li key={c.id} className="pl-4 relative">
                          <div className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-brand-500 ring-4 ring-brand-100" />
                          <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
                            <span className="font-medium text-slate-700">{c.operator}</span>
                            <span className="text-slate-400">·</span><span>{c.operatorRole}</span>
                            <span className="text-slate-400">·</span><ShiftBadge shift={c.shift} />
                            <span className="text-slate-400">·</span><span>{formatDateTime(c.changeTime)}</span>
                          </div>
                          <div className="text-sm text-slate-800">
                            字段 <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">{c.field}</code>
                            <span className="text-slate-400 mx-1.5">：</span>
                            <span className="line-through text-red-500/70">{c.oldValue}</span>
                            <span className="mx-1.5 text-slate-400">→</span>
                            <span className="text-emerald-700 font-medium">{c.newValue}</span>
                          </div>
                          {c.reason && (
                            <div className="mt-1 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded px-2 py-1 inline-block">
                              <span className="text-slate-400 mr-1">原因：</span>{c.reason}
                            </div>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>

                {inheritedChanges.length > 0 && (
                  <div>
                    <div className="text-xs text-slate-500 mb-2 font-medium flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-violet-300" />
                      继承自链路历史变更（{inheritedChanges.length} 条 · 来自父记录及更早）
                    </div>
                    <ol className="relative border-l border-violet-200 ml-2 space-y-3 opacity-75">
                      {inheritedChanges.slice(0, 10).map((c) => (
                        <li key={c.id} className="pl-4 relative">
                          <div className="absolute -left-[7px] top-1 w-3 h-3 rounded-full bg-violet-400 ring-4 ring-violet-100" />
                          <div className="flex items-center gap-2 text-xs text-slate-500 mb-0.5">
                            <code className="px-1 py-0.5 rounded bg-violet-50 text-violet-600 font-mono text-[10px]">{c.inspectionId}</code>
                            <span className="font-medium text-slate-700">{c.operator}</span>
                            <span className="text-slate-400">·</span><span>{c.operatorRole}</span>
                            <span className="text-slate-400">·</span><span>{formatDateTime(c.changeTime)}</span>
                          </div>
                          <div className="text-sm text-slate-700">
                            字段 <code className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[11px]">{c.field}</code>
                            <span className="text-slate-400 mx-1.5">：</span>
                            <span className="line-through text-red-500/50">{c.oldValue}</span>
                            <span className="mx-1.5 text-slate-400">→</span>
                            <span className="text-emerald-600 font-medium">{c.newValue}</span>
                          </div>
                          {c.reason && (
                            <div className="mt-1 text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded px-2 py-1 inline-block">
                              <span className="text-slate-400 mr-1">原因：</span>{c.reason}
                            </div>
                          )}
                        </li>
                      ))}
                      {inheritedChanges.length > 10 && (
                        <li className="pl-4 text-xs text-slate-400">还有 {inheritedChanges.length - 10} 条更早的变更，可追溯历史链路查看</li>
                      )}
                    </ol>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {showRerunModal && (
        <RerunModal inspection={inspection} onClose={() => setShowRerunModal(false)} />
      )}
    </div>
  )
}
