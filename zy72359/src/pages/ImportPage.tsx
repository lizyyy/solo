import { useState, useMemo } from 'react'
import {
  Upload, AlertTriangle, FileUp, Pencil, Check, X, ShieldAlert,
  ChevronDown, ChevronRight, Copy, Plus, History, Gauge, UserRound
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import {
  STATUS_LABELS, STATUS_COLORS, ROLE_LABELS, NEXT_HANDLER_LABELS,
  ACTION_LABELS, ACTION_COLORS
} from '@/types'
import type { CalibrationRecord, ConflictEvidence, AuditEntry } from '@/types'

const INIT_FORM = {
  batchNo: '', temperatureCalibration: '', sensorNo: '',
  sensorNote: '', mainMaterial: '', coefficient: '1.0', originalCoefficient: '',
}

type DuplicateInfo = { batchNo: string; sensorNo: string; currentBatch: string; historyBatches: string[] } | null

function copyText(text: string) {
  navigator.clipboard.writeText(text)
}

function ImportForm({ onImport, activeBatchId, onCreateBatch, duplicateInfo }: {
  onImport: (f: typeof INIT_FORM) => void
  activeBatchId: string | null
  onCreateBatch: () => void
  duplicateInfo: DuplicateInfo
}) {
  const [form, setForm] = useState(INIT_FORM)
  const set = (k: keyof typeof INIT_FORM, v: string) =>
    setForm((f) => ({ ...f, [k]: v }))
  const canImport = form.batchNo && form.sensorNo && form.temperatureCalibration

  const fields: Array<[keyof typeof INIT_FORM, string, string?]> = [
    ['batchNo', '批次号'], ['temperatureCalibration', '温度校准'],
    ['sensorNo', '传感器编号'], ['sensorNote', '传感器备注'],
    ['mainMaterial', '主体材质'], ['coefficient', '系数'],
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onCreateBatch}
          className="flex items-center gap-1.5 rounded-md bg-steel-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-steel-600"
        >
          <Plus className="h-3.5 w-3.5" /> 新建批次导入
        </button>
        {activeBatchId && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 px-3 py-1 text-xs font-mono text-blue-700 border border-blue-200">
            <History className="h-3 w-3" /> 当前批次: {activeBatchId}
          </span>
        )}
      </div>

      {duplicateInfo && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div className="flex-1">
            <span className="font-medium">重复导入警告：</span>
            本次导入批次 <span className="font-mono font-semibold">{duplicateInfo.currentBatch}</span>
            与历史批次 <span className="font-mono font-semibold">{duplicateInfo.historyBatches.join(' / ')}</span>
            存在相同组合：<span className="font-mono">{duplicateInfo.batchNo} + {duplicateInfo.sensorNo}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        {fields.map(([key, label, ph]) => (
          <label key={key} className="flex flex-col gap-1 text-xs text-steel-600">
            {label}
            <input
              className="rounded-md border border-steel-200 px-2.5 py-1.5 font-mono text-sm focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber/30"
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
              placeholder={ph}
            />
          </label>
        ))}
        <label className="flex flex-col gap-1 text-xs text-steel-600">
          原始系数(选填)
          <input
            className="rounded-md border border-steel-200 px-2.5 py-1.5 font-mono text-sm focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber/30"
            value={form.originalCoefficient}
            onChange={(e) => set('originalCoefficient', e.target.value)}
            placeholder="可选，如 1.0"
          />
        </label>
        <div className="flex items-end">
          <button
            onClick={() => { if (canImport) { onImport(form); setForm(INIT_FORM) } }}
            disabled={!canImport}
            className="flex items-center gap-1.5 rounded-md bg-steel-900 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-steel-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FileUp className="h-3.5 w-3.5" /> 导入记录
          </button>
        </div>
      </div>

      <div
        onClick={() => { if (canImport) { onImport(form); setForm(INIT_FORM) } }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-6 transition-colors ${
          canImport ? 'border-steel-300 bg-steel-50/50 hover:border-amber hover:bg-amber-50/30'
                   : 'border-steel-200 bg-steel-50/30 opacity-60'
        }`}
      >
        <Upload className={`h-8 w-8 ${canImport ? 'text-steel-400' : 'text-steel-300'}`} />
        <p className={`mt-1.5 text-sm ${canImport ? 'text-steel-500' : 'text-steel-400'}`}>
          点击或拖拽模拟导入校准记录
        </p>
      </div>
    </div>
  )
}

function RecordsTable({ records, audits, activeBatchId }: {
  records: CalibrationRecord[]; audits: AuditEntry[]; activeBatchId: string | null
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (id: string) => {
    const n = new Set(expanded)
    if (n.has(id)) n.delete(id); else n.add(id)
    setExpanded(n)
  }
  const reversed = useMemo(() => [...records].reverse(), [records])

  return (
    <div className="overflow-x-auto rounded-md border border-steel-200">
      <table className="w-full text-sm">
        <thead className="bg-steel-100/80">
          <tr className="text-left text-xs text-steel-600">
            <th className="px-3 py-2 font-semibold w-6"></th>
            <th className="px-3 py-2 font-semibold">批次号</th>
            <th className="px-3 py-2 font-semibold">TraceId</th>
            <th className="px-3 py-2 font-semibold">ImportBatchId</th>
            <th className="px-3 py-2 font-semibold">传感器</th>
            <th className="px-3 py-2 font-semibold">温度校准</th>
            <th className="px-3 py-2 font-semibold">系数</th>
            <th className="px-3 py-2 font-semibold">原始系数</th>
            <th className="px-3 py-2 font-semibold">状态</th>
            <th className="px-3 py-2 font-semibold">下一步处理人</th>
            <th className="px-3 py-2 font-semibold">更新时间</th>
          </tr>
        </thead>
        <tbody className="font-mono text-xs">
          {reversed.map((r) => {
            const isCurrent = r.importBatchId === activeBatchId
            const isOpen = expanded.has(r.id)
            const rowAudits = audits.filter((a) => a.recordId === r.id)
            return (
              <>
                <tr
                  key={r.id}
                  onClick={() => toggle(r.id)}
                  className={`cursor-pointer border-t border-steel-100 hover:bg-steel-50/60 ${
                    isCurrent ? 'border-l-4 border-l-blue-500' : ''
                  }`}
                >
                  <td className="px-2 py-2 text-steel-400">
                    {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  </td>
                  <td className="px-3 py-2 text-steel-800">{r.batchNo}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 group">
                      {r.traceId}
                      <Copy
                        className="h-3 w-3 cursor-pointer text-steel-400 opacity-0 group-hover:opacity-100 hover:text-amber"
                        onClick={(e) => { e.stopPropagation(); copyText(r.traceId) }}
                      />
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      {r.importBatchId}
                      {isCurrent
                        ? <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-sans text-blue-700 border border-blue-200">【本次】</span>
                        : <span className="rounded bg-steel-100 px-1.5 py-0.5 text-[10px] font-sans text-steel-600 border border-steel-200">【历史】</span>
                      }
                    </span>
                  </td>
                  <td className="px-3 py-2 text-steel-800">{r.sensorNo}</td>
                  <td className="px-3 py-2 text-steel-800">{r.temperatureCalibration}</td>
                  <td className="px-3 py-2 text-steel-800">{r.coefficient}</td>
                  <td className="px-3 py-2 text-steel-500">{r.originalCoefficient ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-sans ${STATUS_COLORS[r.status]}`}>
                      {STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-steel-700 font-sans">
                    {r.nextHandler ? (
                      <span className="inline-flex items-center gap-1">
                        <UserRound className="h-3 w-3 text-steel-400" />
                        {NEXT_HANDLER_LABELS[r.nextHandler]}
                      </span>
                    ) : <span className="text-steel-400">—</span>}
                  </td>
                  <td className="px-3 py-2 text-steel-500 font-sans text-[11px]">{r.updatedAt}</td>
                </tr>
                {isOpen && (
                  <tr key={`${r.id}-audit`} className="bg-steel-50/40 border-t border-steel-100">
                    <td colSpan={11} className="px-6 py-3">
                      <div className="mb-3 grid grid-cols-2 gap-3">
                        <div className="rounded-md border border-steel-200 bg-white px-3 py-2">
                          <div className="text-[11px] font-sans font-medium text-steel-500 mb-0.5">改系数原因</div>
                          <div className="font-mono text-xs text-steel-800">{r.coefficientChangeReason ?? '—'}</div>
                        </div>
                        <div className="rounded-md border border-steel-200 bg-white px-3 py-2">
                          <div className="text-[11px] font-sans font-medium text-steel-500 mb-0.5">工程师意见</div>
                          <div className="font-mono text-xs text-steel-800">{r.engineerComment ?? '—'}</div>
                        </div>
                      </div>
                      <div className="mb-2 text-[11px] font-sans font-medium text-steel-500">审计时间线（共 {rowAudits.length} 条）</div>
                      <div className="space-y-2">
                        {rowAudits.map((a) => (
                          <div key={a.id} className="flex items-start gap-3 rounded-md bg-white border border-steel-200 px-3 py-2">
                            <span className={`mt-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-sans whitespace-nowrap ${ACTION_COLORS[a.action]}`}>
                              {ACTION_LABELS[a.action]}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-sans text-steel-600">
                                <span className="font-medium text-steel-800 font-mono">{a.field}</span>
                                {a.oldValue !== null && a.oldValue !== undefined && (
                                  <>
                                    <span className="text-steel-400">旧值→</span>
                                    <span className="font-mono text-steel-500">{String(a.oldValue)}</span>
                                    <X className="h-2.5 w-2.5 text-steel-300" />
                                    <span className="text-emerald-600">新值→</span>
                                  </>
                                )}
                                <span className="font-mono text-steel-800">{String(a.newValue)}</span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] font-sans text-steel-400">
                                <span>操作人: <span className="text-steel-600">{a.changedByName}</span></span>
                                <span>时间: <span className="text-steel-600">{a.changedAt}</span></span>
                                {a.reason && <span>原因: <span className="text-amber-700">{a.reason}</span></span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function SensorPatchSection({ records, currentRole, setCurrentRole }: {
  records: CalibrationRecord[]
  currentRole: 'inspector' | 'engineer'
  setCurrentRole: (r: 'inspector' | 'engineer') => void
}) {
  const patchSensorNote = useStore((s) => s.patchSensorNote)
  const [editing, setEditing] = useState<CalibrationRecord | null>(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [reasonDraft, setReasonDraft] = useState('')

  const isMismatched = (r: CalibrationRecord) => {
    const tempNum = r.temperatureCalibration.replace(/[^\d.]/g, '')
    return tempNum && !r.sensorNote.includes(tempNum)
  }

  const open = (r: CalibrationRecord) => {
    setEditing(r); setNoteDraft(r.sensorNote); setReasonDraft('')
  }
  const save = () => {
    if (editing) {
      patchSensorNote(editing.id, noteDraft, reasonDraft.trim() || undefined)
      setEditing(null)
    }
  }

  return (
    <section className="rounded-lg border border-steel-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-semibold text-steel-900">
          <Pencil className="h-4 w-4 text-amber" /> 传感器编号补看
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-steel-500 font-sans">当前角色:</span>
          <div className="flex rounded-md border border-steel-200 overflow-hidden">
            {(['inspector', 'engineer'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setCurrentRole(r)}
                className={`px-3 py-1 text-xs font-sans transition-colors ${
                  currentRole === r ? 'bg-steel-900 text-white' : 'bg-white text-steel-600 hover:bg-steel-50'
                }`}
              >
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-steel-200">
        <table className="w-full text-sm">
          <thead className="bg-steel-100/80">
            <tr className="text-left text-xs text-steel-600">
              <th className="px-3 py-2 font-semibold font-sans">TraceId</th>
              <th className="px-3 py-2 font-semibold font-sans">传感器编号</th>
              <th className="px-3 py-2 font-semibold font-sans">传感器备注</th>
              <th className="px-3 py-2 font-semibold font-sans">温度校准</th>
              <th className="px-3 py-2 font-semibold font-sans">主体材质</th>
              <th className="px-3 py-2 font-semibold font-sans">下一步处理人</th>
              <th className="px-3 py-2 font-semibold font-sans w-16">操作</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            {records.map((r) => {
              const bad = isMismatched(r)
              return (
                <tr
                  key={r.id}
                  onClick={() => open(r)}
                  className={`cursor-pointer border-t border-steel-100 hover:bg-steel-50/60 ${
                    bad ? 'bg-amber-50/50' : ''
                  }`}
                >
                  <td className="px-3 py-2 text-steel-800">{r.traceId}</td>
                  <td className="px-3 py-2 text-steel-800">{r.sensorNo}</td>
                  <td className={`px-3 py-2 ${bad ? 'text-amber-800 font-semibold' : 'text-steel-800'}`}>
                    <span className="inline-flex items-center gap-1.5">
                      {r.sensorNote}
                      {bad && <span className="text-[10px] font-sans text-amber-700">⚠ 不一致</span>}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-steel-800">{r.temperatureCalibration}</td>
                  <td className="px-3 py-2 text-steel-800">{r.mainMaterial}</td>
                  <td className="px-3 py-2 font-sans text-[11px] text-steel-600">
                    {r.nextHandler ? NEXT_HANDLER_LABELS[r.nextHandler] : '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 rounded-md bg-steel-100 px-2 py-0.5 text-[10px] font-sans text-steel-600">
                      <Pencil className="h-2.5 w-2.5" /> 编辑
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setEditing(null)}>
          <div className="w-[480px] rounded-lg bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-sm font-semibold text-steel-900 font-sans">
              编辑传感器备注 — <span className="font-mono">{editing.sensorNo}</span>
            </h3>
            <label className="mb-1 block text-xs text-steel-600 font-sans">传感器备注</label>
            <textarea
              className="w-full rounded-md border border-steel-200 px-3 py-2 font-mono text-sm focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber/30"
              rows={4}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
            />
            <label className="mt-3 mb-1 block text-xs text-steel-600 font-sans">补录原因（可选）</label>
            <input
              className="w-full rounded-md border border-steel-200 px-3 py-2 font-sans text-sm focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber/30"
              value={reasonDraft}
              onChange={(e) => setReasonDraft(e.target.value)}
              placeholder="如：补录现场温度漂移说明"
            />
            <p className="mt-2 text-[11px] font-sans text-amber-700 bg-amber-50 rounded px-2 py-1.5 border border-amber-200">
              💡 传感器备注常常藏着关键备注，请把温度、漂移情况等信息写清楚，方便后续反查
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setEditing(null)}
                className="rounded-md border border-steel-200 px-4 py-1.5 text-xs font-sans text-steel-600 hover:bg-steel-50"
              >取消</button>
              <button
                onClick={save}
                className="rounded-md bg-steel-900 px-4 py-1.5 text-xs font-sans font-medium text-white hover:bg-steel-800"
              >保存</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function ConflictPanel({ conflicts, records, currentRole }: {
  conflicts: ConflictEvidence[]; records: CalibrationRecord[]; currentRole: 'inspector' | 'engineer'
}) {
  const confirmConflict = useStore((s) => s.confirmConflict)
  const rejectConflict = useStore((s) => s.rejectConflict)
  const [reasons, setReasons] = useState<Record<string, string>>({})

  const recordMap = useMemo(() => {
    const m = new Map<string, CalibrationRecord>()
    records.forEach((r) => m.set(r.id, r))
    return m
  }, [records])

  const severityBadge = (s: ConflictEvidence['severity']) =>
    s === 'high'
      ? <span className="rounded-md bg-red-100 text-red-700 px-1.5 py-0.5 text-[10px] font-sans border border-red-200 font-medium">高</span>
      : <span className="rounded-md bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[10px] font-sans border border-amber-200 font-medium">中</span>

  const statusBadge = (r: ConflictEvidence['resolution']) => {
    if (r === 'pending') return <span className="rounded-md bg-amber-50 text-amber-700 px-1.5 py-0.5 text-[10px] font-sans border border-amber-200">待处理</span>
    if (r === 'confirmed') return <span className="rounded-md bg-emerald-50 text-emerald-700 px-1.5 py-0.5 text-[10px] font-sans border border-emerald-200">已确认</span>
    return <span className="rounded-md bg-steel-100 text-steel-600 px-1.5 py-0.5 text-[10px] font-sans border border-steel-200">已驳回</span>
  }

  return (
    <section className="rounded-lg border border-steel-200 bg-white p-5 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-steel-900">
        <ShieldAlert className="h-4 w-4 text-amber" /> 冲突检测面板
        <span className="ml-1 rounded-full bg-steel-100 px-2 py-0.5 text-[10px] font-sans text-steel-600">
          {conflicts.length} 条
        </span>
      </h2>

      {conflicts.length === 0 && (
        <p className="py-6 text-center text-sm text-steel-400 font-sans">暂无冲突记录</p>
      )}

      <div className="space-y-3">
        {conflicts.map((c) => {
          const rec = recordMap.get(c.recordId)
          const borderClass = c.severity === 'high'
            ? 'border-red-300 bg-red-50/30'
            : 'border-amber-300 bg-amber-50/30'
          const leftCard = c.resolution === 'rejected' ? 'opacity-60 line-through' : ''
          const rightCard = c.resolution === 'confirmed' ? 'opacity-60 line-through' : ''

          return (
            <div key={c.id} className={`rounded-lg border p-4 ${borderClass}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gauge className={`h-4 w-4 ${c.severity === 'high' ? 'text-red-600' : 'text-amber-600'}`} />
                  <span className="font-sans text-sm font-semibold text-steel-800">{c.field} 字段冲突</span>
                  {severityBadge(c.severity)}
                  {statusBadge(c.resolution)}
                </div>
                {c.resolution !== 'pending' && c.resolvedAt && (
                  <span className="text-[11px] font-sans text-steel-500">
                    {c.resolvedBy} · {c.resolvedAt}
                  </span>
                )}
              </div>

              <div className="mt-3 flex items-stretch gap-3">
                <div className={`flex-1 rounded-md border border-emerald-200 bg-white px-3 py-2 ${leftCard}`}>
                  <div className="flex items-center gap-1 text-[10px] font-sans text-emerald-700 mb-1">
                    <Check className="h-2.5 w-2.5" /> 校准值（保留）
                  </div>
                  <p className="font-mono text-xs text-steel-800 break-words">{c.calibrationValue}</p>
                </div>
                <div className="flex items-center text-steel-400 font-sans text-xs">
                  <span className="flex flex-col items-center gap-0.5">
                    <span className="w-px h-4 bg-steel-300" />
                    <span>VS</span>
                    <span className="w-px h-4 bg-steel-300" />
                  </span>
                </div>
                <div className={`flex-1 rounded-md border border-amber-200 bg-white px-3 py-2 ${rightCard}`}>
                  <div className="flex items-center gap-1 text-[10px] font-sans text-amber-700 mb-1">
                    <AlertTriangle className="h-2.5 w-2.5" /> 传感器值（对比）
                  </div>
                  <p className="font-mono text-xs text-steel-800 break-words">{c.sensorValue}</p>
                </div>
              </div>

              {rec && (
                <div className="mt-3 flex items-center gap-3 text-[11px] font-sans text-steel-500">
                  <span className="inline-flex items-center gap-1">
                    关联记录:
                    <span className="font-mono text-steel-700 group inline-flex items-center gap-1 cursor-pointer hover:text-amber"
                      onClick={() => copyText(rec.traceId)}>
                      {rec.traceId}
                      <Copy className="h-2.5 w-2.5 text-steel-300 group-hover:text-amber opacity-0 group-hover:opacity-100" />
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1">
                    批次:
                    <span className="font-mono text-steel-700 group inline-flex items-center gap-1 cursor-pointer hover:text-amber"
                      onClick={() => copyText(rec.importBatchId)}>
                      {rec.importBatchId}
                      <Copy className="h-2.5 w-2.5 text-steel-300 group-hover:text-amber opacity-0 group-hover:opacity-100" />
                    </span>
                  </span>
                </div>
              )}

              {c.resolution !== 'pending' && c.resolutionReason && (
                <div className="mt-2 rounded-md bg-white/70 px-3 py-2 border border-steel-200">
                  <div className="text-[10px] font-sans text-steel-500 mb-0.5">处理说明</div>
                  <p className="text-xs font-sans text-steel-700">{c.resolutionReason}</p>
                </div>
              )}

              {c.resolution === 'pending' && (
                <div className="mt-3 space-y-2">
                  <input
                    className="w-full rounded-md border border-steel-200 bg-white px-3 py-1.5 font-sans text-xs focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber/30"
                    placeholder="处理理由（选填，将记入审计日志）"
                    value={reasons[c.id] || ''}
                    onChange={(e) => setReasons({ ...reasons, [c.id]: e.target.value })}
                  />
                  {currentRole === 'inspector' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => { confirmConflict(c.id, reasons[c.id]?.trim()); setReasons({ ...reasons, [c.id]: '' }) }}
                        className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-sans font-medium text-white hover:bg-emerald-700"
                      >
                        <Check className="h-3 w-3" /> 确认（以校准值为准）
                      </button>
                      <button
                        onClick={() => { rejectConflict(c.id, reasons[c.id]?.trim()); setReasons({ ...reasons, [c.id]: '' }) }}
                        className="flex items-center gap-1 rounded-md border border-steel-300 bg-white px-3 py-1.5 text-xs font-sans font-medium text-steel-700 hover:bg-steel-50"
                      >
                        <X className="h-3 w-3" /> 驳回（返回重测）
                      </button>
                    </div>
                  )}
                  {currentRole !== 'inspector' && (
                    <p className="text-[11px] font-sans text-steel-500 bg-steel-50 rounded px-2 py-1.5 border border-steel-200">
                      ⚠ 仅质检员可处理冲突，请切换角色后操作
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function ImportPage() {
  const records = useStore((s) => s.records)
  const conflicts = useStore((s) => s.conflicts)
  const audits = useStore((s) => s.audits)
  const currentRole = useStore((s) => s.currentRole)
  const activeImportBatchId = useStore((s) => s.activeImportBatchId)
  const importRecord = useStore((s) => s.importRecord)
  const newActiveBatch = useStore((s) => s.newActiveBatch)
  const setCurrentRole = useStore((s) => s.setCurrentRole)

  const [duplicateInfo, setDuplicateInfo] = useState<DuplicateInfo>(null)

  const handleImport = (f: typeof INIT_FORM) => {
    const result = importRecord({
      batchNo: f.batchNo,
      temperatureCalibration: f.temperatureCalibration,
      sensorNo: f.sensorNo,
      sensorNote: f.sensorNote,
      mainMaterial: f.mainMaterial,
      coefficient: parseFloat(f.coefficient) || 1.0,
      originalCoefficient: f.originalCoefficient ? parseFloat(f.originalCoefficient) : null,
    })
    if (result.duplicate) {
      const updated = useStore.getState().records
      const historyBatches = updated
        .filter((r) => r.batchNo === f.batchNo && r.sensorNo === f.sensorNo && r.id !== result.id)
        .map((r) => r.importBatchId)
      const currentBatch = activeImportBatchId || (result.isNewBatch ? `BATCH-CUR-00${useStore.getState().batches.length}` : '')
      setDuplicateInfo({
        batchNo: f.batchNo,
        sensorNo: f.sensorNo,
        currentBatch,
        historyBatches: Array.from(new Set(historyBatches)),
      })
      setTimeout(() => setDuplicateInfo(null), 8000)
    }
  }

  const handleCreateBatch = () => {
    newActiveBatch()
    setDuplicateInfo(null)
  }

  return (
    <div className="space-y-6 font-sans">
      <section className="rounded-lg border border-steel-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-steel-900">
          <Upload className="h-4 w-4 text-amber" /> 温度校准记录导入
        </h2>
        <ImportForm
          onImport={handleImport}
          activeBatchId={activeImportBatchId}
          onCreateBatch={handleCreateBatch}
          duplicateInfo={duplicateInfo}
        />
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-medium text-steel-600 font-sans">记录列表（共 {records.length} 条，倒序显示）</div>
          </div>
          <RecordsTable records={records} audits={audits} activeBatchId={activeImportBatchId} />
        </div>
      </section>

      <SensorPatchSection records={records} currentRole={currentRole} setCurrentRole={setCurrentRole} />

      <ConflictPanel conflicts={conflicts} records={records} currentRole={currentRole} />
    </div>
  )
}
