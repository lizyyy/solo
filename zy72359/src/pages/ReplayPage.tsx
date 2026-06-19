import { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Activity, AlertTriangle, CheckCircle, XCircle, Send, Copy, History, RefreshCw, Clock, User } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { STATUS_LABELS, STATUS_COLORS, ROLE_LABELS, NEXT_HANDLER_LABELS, ACTION_LABELS, ACTION_COLORS, CHECK_TYPE_LABELS, type CalibrationRecord, type PumpSpeedCurve, type AuditEntry } from '@/types'

type Props = { selectedId: string; setSelectedId: (id: string) => void }

function CurveSection({ selectedId, setSelectedId }: Props) {
  const records = useStore((s) => s.records)
  const curves = useStore((s) => s.curves)
  const currentRole = useStore((s) => s.currentRole)
  const patchCoefficient = useStore((s) => s.patchCoefficient)
  const recalcCurvesForRecord = useStore((s) => s.recalcCurvesForRecord)
  const [showBase, setShowBase] = useState(true)
  const [showCurrent, setShowCurrent] = useState(true)
  const [newCoeff, setNewCoeff] = useState('')
  const [coeffReason, setCoeffReason] = useState('')
  const [copied, setCopied] = useState(false)
  const [recalcTip, setRecalcTip] = useState(false)

  const availableCurves = useMemo(() => curves.filter((c) => records.some((r) => r.id === c.recordId)), [curves, records])
  const curve = curves.find((c) => c.recordId === selectedId)
  const record = records.find((r) => r.id === selectedId)
  const isHistoryBatch = record?.importBatchId.startsWith('BATCH-HIST-')
  const chartData = curve ? curve.pressure.map((p, i) => ({ pressure: p, 基准抽速: curve.baseSpeed[i], 当前抽速: curve.speed[i] })) : []

  const handleCopy = () => { if (record) { navigator.clipboard.writeText(record.traceId); setCopied(true); setTimeout(() => setCopied(false), 1500) } }
  const handleSave = () => {
    if (!selectedId || !newCoeff) return
    const nc = parseFloat(newCoeff)
    if (isNaN(nc)) return
    patchCoefficient(selectedId, nc, coeffReason.trim() || null)
    setNewCoeff(''); setCoeffReason('')
  }
  const handleRecalc = () => { if (selectedId) { recalcCurvesForRecord(selectedId); setRecalcTip(true); setTimeout(() => setRecalcTip(false), 2000) } }

  return (
    <section className="rounded-lg border border-steel-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2"><Activity className="h-5 w-5 text-amber" /><h2 className="text-base font-semibold text-steel-900">曲线参数回放</h2></div>
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-steel-600">选择记录</label>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="rounded-md border border-steel-300 bg-white px-3 py-1.5 text-sm font-mono text-steel-800 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber">
          {availableCurves.map((c) => { const r = records.find((rec) => rec.id === c.recordId); return <option key={c.recordId} value={c.recordId}>{r ? `${r.batchNo} · ${r.traceId}` : c.recordId}</option> })}
        </select>
      </div>
      {curve && record ? (
        <div className="flex gap-5">
          <div className="flex-1">
            <div className="mb-3 flex items-center gap-4 text-xs text-steel-600">
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={showBase} onChange={(e) => setShowBase(e.target.checked)} className="h-3.5 w-3.5 rounded border-steel-300 text-amber focus:ring-amber" />基准曲线</label>
              <label className="flex items-center gap-1.5"><input type="checkbox" checked={showCurrent} onChange={(e) => setShowCurrent(e.target.checked)} className="h-3.5 w-3.5 rounded border-steel-300 text-amber focus:ring-amber" />当前曲线</label>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#d9e2ec" />
                <XAxis dataKey="pressure" type="number" label={{ value: '压力 (Pa)', position: 'insideBottom', offset: -5, style: { fontSize: 11, fill: '#627d98' } }} tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} stroke="#627d98" />
                <YAxis label={{ value: '抽速 (L/s)', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#627d98' } }} tick={{ fontSize: 11, fontFamily: 'JetBrains Mono' }} stroke="#627d98" />
                <Tooltip contentStyle={{ fontFamily: 'JetBrains Mono', fontSize: 11, borderRadius: 6, border: '1px solid #bcccdc' }} labelFormatter={(v) => `压力: ${v} Pa`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {showBase && <Line type="monotone" dataKey="基准抽速" stroke="#829ab1" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 2.5 }} name="基准抽速" />}
                {showCurrent && <Line type="monotone" dataKey="当前抽速" stroke="#D97706" strokeWidth={2.5} dot={{ r: 3 }} name="当前抽速" />}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="w-80 flex-shrink-0 space-y-3">
            <div className="rounded-md border border-steel-100 bg-steel-50/60 p-3">
              <div className="mb-1.5 flex items-start justify-between">
                <span className="text-xs font-medium text-steel-500">追踪编号</span>
                <button onClick={handleCopy} className="flex items-center gap-1 rounded px-1 py-0.5 text-steel-500 hover:bg-steel-200/60 hover:text-steel-700"><Copy className="h-3 w-3" /><span className="text-[10px]">{copied ? '已复制' : '复制'}</span></button>
              </div>
              <p className="font-mono text-sm font-semibold text-steel-900">{record.traceId}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-md border border-steel-100 bg-steel-50/60 p-3"><p className="mb-1 text-xs font-medium text-steel-500">导入批次</p><p className="font-mono text-sm font-semibold text-steel-900">{record.importBatchId}</p></div>
              <span className={`rounded-md border px-2 py-1 text-[10px] font-medium ${isHistoryBatch ? 'border-steel-200 bg-steel-100 text-steel-600' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{isHistoryBatch ? '历史导入' : '本次导入'}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-md border border-steel-100 bg-steel-50/60 p-3"><p className="mb-1 text-xs font-medium text-steel-500">系数</p><p className="font-mono text-xl font-bold text-amber">{curve.coefficient}</p></div>
              <div className="flex-1 rounded-md border border-steel-100 bg-steel-50/60 p-3"><p className="mb-1 text-xs font-medium text-steel-500">版本号</p><p className="font-mono text-xl font-bold text-steel-900">v{curve.version}</p></div>
              <span className={`rounded-md border px-2 py-1 text-xs font-medium ${STATUS_COLORS[record.status]}`}>{STATUS_LABELS[record.status]}</span>
            </div>
            <div className="rounded-md border border-steel-100 bg-steel-50/60 p-3">
              <p className="mb-1 text-xs font-medium text-steel-500">改系数原因</p>
              <p className={`font-mono text-sm ${record.coefficientChangeReason ? 'text-steel-800' : 'text-amber-600'}`}>
                {record.coefficientChangeReason ?? '未填写'}
              </p>
            </div>
            <div className="rounded-md border border-steel-100 bg-steel-50/60 p-3">
              <p className="mb-1 text-xs font-medium text-steel-500">工程师意见</p>
              <p className={`font-mono text-sm ${record.engineerComment ? 'text-steel-800' : 'text-steel-400'}`}>
                {record.engineerComment ?? '—'}
              </p>
            </div>
            {record.nextHandler && (
              <div className="rounded-md border border-amber-100 bg-amber-50/50 p-3">
                <div className="flex items-center gap-1.5"><User className="h-3.5 w-3.5 text-amber-700" /><span className="text-xs font-medium text-amber-800">下一步处理人：{NEXT_HANDLER_LABELS[record.nextHandler]}</span></div>
                {record.nextHandlerNote && <p className="mt-1.5 border-l-2 border-amber-200 pl-2 text-xs text-amber-700">{record.nextHandlerNote}</p>}
              </div>
            )}
            <div className="rounded-md border border-steel-100 bg-steel-50/60 p-3"><p className="mb-1 text-xs font-medium text-steel-500">计算明细</p><p className="text-xs leading-relaxed text-steel-700">{curve.calculationDetail}</p></div>
            {currentRole === 'inspector' && (
              <div className="rounded-md border border-steel-200 bg-white p-3">
                <p className="mb-2 text-xs font-semibold text-steel-700">编辑系数</p>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2"><span className="w-12 text-xs text-steel-500">新系数</span><input type="number" step="0.01" value={newCoeff} onChange={(e) => setNewCoeff(e.target.value)} placeholder="输入新系数" className="flex-1 rounded-md border border-steel-300 px-2.5 py-1.5 font-mono text-sm text-steel-800 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber" /></div>
                  <div className="flex items-center gap-2"><span className="w-12 text-xs text-steel-500">原因</span><input type="text" value={coeffReason} onChange={(e) => setCoeffReason(e.target.value)} placeholder="可选，修改原因" className="flex-1 rounded-md border border-steel-300 px-2.5 py-1.5 text-sm text-steel-800 focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber" /></div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <button onClick={handleSave} disabled={!newCoeff} className="flex-1 rounded-md bg-amber px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50">保存</button>
                    {newCoeff && !coeffReason.trim() && <span className="text-[10px] text-amber-700">未填原因将转设备工程师复核</span>}
                  </div>
                </div>
              </div>
            )}
            <button onClick={handleRecalc} className="flex w-full items-center justify-center gap-1.5 rounded-md border border-steel-200 bg-steel-50 px-3 py-2 text-xs font-medium text-steel-700 hover:bg-steel-100"><RefreshCw className="h-3.5 w-3.5" />立即重算{recalcTip && <span className="text-emerald-600">（版本已升级）</span>}</button>
          </div>
        </div>
      ) : <p className="py-12 text-center text-sm text-steel-400">暂无曲线数据</p>}
    </section>
  )
}

function CoefficientMarkSection() {
  const records = useStore((s) => s.records)
  const audits = useStore((s) => s.audits)
  const submitCoefficientReason = useStore((s) => s.submitCoefficientReason)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const pendingRecords = records.filter((r) => r.originalCoefficient !== null && !r.coefficientChangeReason)
  if (pendingRecords.length === 0) return null

  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50/40 p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber" /><h2 className="text-base font-semibold text-steel-900">人工改系数标记</h2><span className="rounded-full bg-amber px-2 py-0.5 text-xs font-medium text-white">{pendingRecords.length}</span></div>
      <div className="mb-3 rounded-md border border-amber-200 bg-white/80 px-3 py-2 text-xs text-amber-800">人工改过系数但没写原因 → 不归正常，留给设备工程师复核</div>
      <div className="space-y-3">
        {pendingRecords.map((r) => {
          const coeffAudits = audits.filter((a) => a.recordId === r.id && a.field === 'coefficient').sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
          return (
            <div key={r.id} className="rounded-md border border-amber-100 bg-white p-4">
              <div className="mb-2 flex items-center gap-2 text-sm">
                <span className="font-mono font-semibold text-steel-800">{r.traceId}</span><span className="text-steel-300">·</span><span className="font-mono text-steel-600">{r.importBatchId}</span><span className="text-steel-300">·</span><span className="text-steel-600">{r.batchNo}</span>
                <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status]}`}>{STATUS_LABELS[r.status]}</span>
              </div>
              <div className="mb-2 flex items-center gap-2 text-sm"><span className="font-mono text-steel-500 line-through">{r.originalCoefficient}</span><span className="text-steel-400">→</span><span className="font-mono font-bold text-amber">{r.coefficient}</span><span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-mono text-amber-800">Δ{(r.coefficient - r.originalCoefficient!).toFixed(2)}</span></div>
              {r.nextHandler && <div className="mb-2 flex items-start gap-1.5 rounded-md bg-steel-50 px-2.5 py-1.5 text-xs"><User className="mt-0.5 h-3 w-3 text-steel-500" /><div><span className="font-medium text-steel-600">下一步处理人：</span><span className="font-medium text-steel-800">{NEXT_HANDLER_LABELS[r.nextHandler]}</span>{r.nextHandlerNote && <div className="mt-0.5 text-steel-500">{r.nextHandlerNote}</div>}</div></div>}
              {coeffAudits.length > 0 && (
                <div className="mb-2.5 rounded-md border border-steel-100 bg-steel-50/50 p-2">
                  <p className="mb-1 text-[11px] font-medium text-steel-500">改前改后历史对比</p>
                  {coeffAudits.map((a) => (
                    <div key={a.id} className="flex items-center gap-1.5 text-[11px]">
                      <span className="font-mono text-steel-500">{String(a.oldValue)}</span><span className="text-steel-400">→</span><span className="font-mono font-medium text-steel-800">{String(a.newValue)}</span><span className="text-steel-300">·</span><span className="text-steel-600">{a.changedByName}</span><span className="text-steel-300">·</span><span className="font-mono text-steel-500">{a.changedAt.slice(5, 16)}</span>
                      {a.reason && <><span className="text-steel-300">·</span><span className="text-steel-500">{a.reason}</span></>}
                    </div>
                  ))}
                </div>
              )}
              {r.engineerComment && (
                <div className="mb-2.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-2">
                  <p className="text-xs font-medium text-blue-700">工程师意见：{r.engineerComment}</p>
                </div>
              )}
              <div className="flex gap-2">
                <input type="text" placeholder="请输入修改原因..." value={reasons[r.id] ?? ''} onChange={(e) => setReasons((prev) => ({ ...prev, [r.id]: e.target.value }))} className="flex-1 rounded-md border border-steel-300 px-3 py-1.5 text-sm focus:border-amber focus:outline-none focus:ring-1 focus:ring-amber" />
                <button onClick={() => { const reason = reasons[r.id]?.trim(); if (reason) { submitCoefficientReason(r.id, reason); setReasons((prev) => { const next = { ...prev }; delete next[r.id]; return next }) } }} disabled={!reasons[r.id]?.trim()} className="flex items-center gap-1.5 rounded-md bg-amber px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-3.5 w-3.5" />提交原因</button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function EngineerReviewSection() {
  const records = useStore((s) => s.records)
  const audits = useStore((s) => s.audits)
  const currentRole = useStore((s) => s.currentRole)
  const reviewRecord = useStore((s) => s.reviewRecord)
  const [comments, setComments] = useState<Record<string, string>>({})
  if (currentRole !== 'engineer') return null
  const reviewRecords = records.filter((r) => r.status === 'pending_review' && r.coefficientChangeReason)
  if (reviewRecords.length === 0) return null

  return (
    <section className="rounded-lg border border-emerald-200 bg-emerald-50/30 p-5 shadow-sm">
      <div className="mb-3 flex items-center gap-2"><CheckCircle className="h-5 w-5 text-emerald-600" /><h2 className="text-base font-semibold text-steel-900">设备工程师复核</h2><span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-medium text-white">{reviewRecords.length}</span></div>
      <div className="space-y-3">
        {reviewRecords.map((r) => {
          const recordAudits = audits.filter((a) => a.recordId === r.id).sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())
          const lastCoeffAudit = [...recordAudits].reverse().find((a) => a.field === 'coefficient' && a.oldValue !== null)
          return (
            <div key={r.id} className="rounded-md border border-steel-200 bg-white p-4">
              <div className="mb-2 flex items-center gap-2 text-sm"><span className="font-mono font-semibold text-steel-800">{r.traceId}</span><span className="text-steel-300">·</span><span className="font-mono text-steel-600">{r.importBatchId}</span><span className="text-steel-300">·</span><span className="text-steel-600">{r.batchNo}</span><span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[r.status]}`}>{STATUS_LABELS[r.status]}</span></div>
              <div className="mb-2 flex items-center gap-2 text-sm"><span className="font-mono text-steel-500 line-through">{r.originalCoefficient}</span><span className="text-steel-400">→</span><span className="font-mono font-bold text-emerald-700">{r.coefficient}</span><span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-mono text-emerald-800">Δ{(r.coefficient - r.originalCoefficient!).toFixed(2)}</span>{lastCoeffAudit && <><span className="text-steel-300">·</span><span className="text-xs text-steel-500">操作人：{lastCoeffAudit.changedByName}</span></>}</div>
              <div className="mb-2.5 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><span className="font-medium">修改原因：</span>{r.coefficientChangeReason}</div>
              {recordAudits.length > 0 && (
                <div className="mb-2.5 rounded-md border border-steel-100 bg-steel-50/50 p-2">
                  <p className="mb-1 text-[11px] font-medium text-steel-500">历史审计记录</p>
                  {recordAudits.slice(0, 5).map((a) => (
                    <div key={a.id} className="flex items-center gap-1.5 text-[11px]">
                      <span className={`rounded border px-1.5 py-px text-[10px] font-medium ${ACTION_COLORS[a.action]}`}>{ACTION_LABELS[a.action]}</span><span className="text-steel-600">{a.field}</span>
                      {a.oldValue !== null && <><span className="font-mono text-steel-500 line-through">{String(a.oldValue)}</span><span className="text-steel-400">→</span></>}
                      <span className="font-mono font-medium text-steel-800">{String(a.newValue)}</span><span className="text-steel-300">·</span><span className="text-steel-600">{a.changedByName}</span><span className="text-steel-300">·</span><span className="font-mono text-steel-500">{a.changedAt.slice(5, 16)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input type="text" placeholder="复核意见（可选）..." value={comments[r.id] ?? ''} onChange={(e) => setComments((prev) => ({ ...prev, [r.id]: e.target.value }))} className="flex-1 rounded-md border border-steel-300 px-3 py-1.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                <button onClick={() => reviewRecord(r.id, true, comments[r.id] ?? '')} className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"><CheckCircle className="h-3.5 w-3.5" />通过</button>
                <button onClick={() => reviewRecord(r.id, false, comments[r.id] ?? '')} className="flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"><XCircle className="h-3.5 w-3.5" />驳回</button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function RecordHistorySection({ selectedId }: { selectedId: string }) {
  const audits = useStore((s) => s.audits)
  const records = useStore((s) => s.records)
  const record = records.find((r) => r.id === selectedId)
  const recordAudits = audits.filter((a) => a.recordId === selectedId).sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime())

  return (
    <section className="rounded-lg border border-steel-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2"><History className="h-5 w-5 text-steel-700" /><h2 className="text-base font-semibold text-steel-900">记录审计时间线</h2></div>
        {record && <span className="font-mono text-xs text-steel-500">{record.traceId}</span>}
      </div>
      {recordAudits.length === 0 ? <p className="py-8 text-center text-sm text-steel-400">暂无审计记录</p> : (
        <div className="relative pl-6">
          <div className="absolute left-2 top-1.5 bottom-1.5 w-px bg-steel-200" />
          <div className="space-y-3">
            {recordAudits.map((a, idx) => (
              <div key={a.id} className="relative">
                <div className={`absolute -left-4 top-1 h-2.5 w-2.5 rounded-full border-2 ${idx === 0 ? 'border-emerald-500 bg-emerald-500' : 'border-steel-400 bg-white'}`} />
                <div className="rounded-md border border-steel-100 bg-steel-50/60 p-2.5">
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${ACTION_COLORS[a.action]}`}>{ACTION_LABELS[a.action]}</span>
                    <span className="text-xs font-medium text-steel-700">{a.field}</span>
                    <div className="ml-auto flex items-center gap-1 text-[11px] text-steel-500"><Clock className="h-3 w-3" /><span className="font-mono">{a.changedAt}</span></div>
                  </div>
                  <div className="mb-1 flex items-center gap-1.5 text-xs"><User className="h-3 w-3 text-steel-400" /><span className="text-steel-600">{a.changedByName}</span></div>
                  {(a.oldValue !== null || a.newValue !== null) && (
                    <div className="mt-1 flex items-center gap-1.5 rounded-md bg-white px-2 py-1 text-xs">
                      {a.oldValue !== null && <><span className="text-steel-500">旧值：</span><span className="font-mono text-steel-500 line-through">{String(a.oldValue)}</span><span className="text-steel-300">→</span></>}
                      <span className="text-steel-600">新值：</span><span className="font-mono font-semibold text-steel-800">{String(a.newValue)}</span>
                    </div>
                  )}
                  {a.reason && <div className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800"><span className="font-medium">原因：</span>{a.reason}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export default function ReplayPage() {
  const curves = useStore((s) => s.curves)
  const [selectedId, setSelectedId] = useState<string>(curves[0]?.recordId ?? '')
  return (
    <div className="space-y-5 font-sans">
      <CurveSection selectedId={selectedId} setSelectedId={setSelectedId} />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5"><CoefficientMarkSection /></div>
        <div className="space-y-5"><EngineerReviewSection /><RecordHistorySection selectedId={selectedId} /></div>
      </div>
    </div>
  )
}
