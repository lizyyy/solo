import { useMemo, useState } from 'react'
import {
  FileDown, ShieldCheck, RefreshCw, Download, CheckCircle2, XCircle,
  Copy, ChevronDown, ChevronUp, Link2, FileBarChart, AlertTriangle,
  Layers, CheckCheck, History, User, ArrowRight
} from 'lucide-react'
import { useStore } from '@/store/useStore'
import {
  STATUS_LABELS, STATUS_COLORS, ROLE_LABELS, NEXT_HANDLER_LABELS,
  ACTION_LABELS, ACTION_COLORS, CHECK_TYPE_LABELS
} from '@/types'
import type { CalibrationRecord, SelfCheckResult, AuditEntry, PumpSpeedCurve, ImportBatch } from '@/types'

const cp = (t: string) => navigator.clipboard?.writeText(t)
const S = 'rounded-md border border-steel-200 bg-steel-50/50 p-5 font-sans'
const H = 'flex items-center gap-2 text-base font-semibold text-steel-900 mb-4'
const B = 'inline-flex items-center gap-1 rounded border bg-steel-50 px-1.5 py-0.5 font-mono text-[10px] text-steel-700 hover:border-amber group'
const M = 'font-mono text-xs'

function SelfCheckSection() {
  const selfCheckResults = useStore((s) => s.selfCheckResults)
  const runSelfCheckNow = useStore((s) => s.runSelfCheckNow)
  const records = useStore((s) => s.records)
  const last = selfCheckResults[0]?.checkedAt
  const passed = selfCheckResults.filter((r) => r.passed).length
  const tm = useMemo(() => { const m: Record<string, string> = {}; records.forEach((r) => { m[r.id] = r.traceId }); return m }, [records])
  const jump = (id: string) => document.getElementById(`row-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  return (
    <section className={S}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={H}><ShieldCheck className="h-5 w-5 text-amber" />自检报告</h2>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-steel-900 px-3 py-1 text-xs font-semibold text-white">{passed}/{selfCheckResults.length} 通过</span>
          {last && <span className="text-xs text-steel-500">检查时间：{new Date(last).toLocaleString('zh-CN')}</span>}
          <button onClick={runSelfCheckNow} className="flex items-center gap-1.5 rounded-md bg-amber px-3 py-1.5 text-xs font-medium text-white hover:bg-amber/90">
            <RefreshCw className="h-3.5 w-3.5" />重新自检
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {selfCheckResults.map((r) => (
          <div key={r.id} className="rounded-md border border-steel-200 bg-white px-4 py-3">
            <div className="flex items-start gap-3">
              {r.passed ? <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald" /> : <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-steel-900">{CHECK_TYPE_LABELS[r.checkType]}</p>
                <p className={`mt-0.5 text-xs ${r.passed ? 'text-steel-500' : 'text-red-600'}`}>{r.detail}</p>
                {r.affectedRecordIds.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[10px] text-steel-500">受影响记录：</span>
                    {r.affectedRecordIds.map((id) => (
                      <button key={id} onClick={() => jump(id)} className={`${B} hover:bg-amber-50 hover:text-amber-700`}>
                        <Link2 className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100" />{id}
                        {tm[id] && <span className="text-steel-400">({tm[id]})</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function ExportSection() {
  const getExportData = useStore((s) => s.getExportData)
  const batches = useStore((s) => s.batches)
  const activeImportBatchId = useStore((s) => s.activeImportBatchId)
  const all = useMemo(() => getExportData(), [getExportData])
  const [bf, setBf] = useState('all')
  const [fmt, setFmt] = useState<'json' | 'csv'>('json')
  const [ea, setEa] = useState<Set<string>>(new Set())
  const [sn, setSn] = useState(false)
  const data = useMemo(() => bf === 'all' ? all : all.filter((r) => r.importBatchId === bf), [all, bf])
  const badge = (r: typeof all[0]) => {
    const ok = r.originalCoefficient === null || r.coefficientChangeReason !== null
    return ok ? (
      <span className="inline-flex items-center gap-0.5 rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"><CheckCheck className="h-2.5 w-2.5" />导出→页面→接口一致</span>
    ) : (
      <span className="inline-flex items-center gap-0.5 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700"><AlertTriangle className="h-2.5 w-2.5" />不一致</span>
    )
  }
  const exp = () => {
    setSn(true); setTimeout(() => setSn(false), 3000)
    if (fmt === 'json') {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob); const a = document.createElement('a')
      a.href = url; a.download = `校准明细-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url)
    } else {
      const hs = ['traceId','importBatchId','batchNo','sensorNo','temperatureCalibration','sensorNote','mainMaterial','coefficient','originalCoefficient','coefficientChangeReason','status','nextHandler','auditCount']
      const rs = data.map((r) => [r.traceId,r.importBatchId,r.batchNo,r.sensorNo,r.temperatureCalibration,`"${r.sensorNote.replace(/"/g,'""')}"`,r.mainMaterial,String(r.coefficient),r.originalCoefficient??'',r.coefficientChangeReason??'',STATUS_LABELS[r.status],r.nextHandler?NEXT_HANDLER_LABELS[r.nextHandler]:'',String(r.audits.length)].join(','))
      const csv = [hs.join(','), ...rs].join('\n')
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob); const a = document.createElement('a')
      a.href = url; a.download = `校准明细-${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url)
    }
  }
  const toggle = (id: string) => setEa((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n })
  return (
    <section className={S}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className={H}><FileDown className="h-5 w-5 text-amber" />明细导出</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select value={bf} onChange={(e) => setBf(e.target.value)} className="rounded-md border border-steel-200 bg-white px-2.5 py-1.5 text-xs text-steel-700 focus:border-amber focus:outline-none">
            <option value="all">全部批次（共 {all.length} 条）</option>
            {batches.map((b) => <option key={b.id} value={b.id}>{b.id} · {b.importedBy} · {b.recordCount}条{b.id === activeImportBatchId ? ' · 本次导入' : ''}</option>)}
          </select>
          <div className="flex rounded-md border border-steel-200 overflow-hidden">
            <button onClick={() => setFmt('json')} className={`px-3 py-1.5 text-xs font-medium ${fmt === 'json' ? 'bg-steel-900 text-white' : 'bg-white text-steel-600 hover:bg-steel-50'}`}>JSON</button>
            <button onClick={() => setFmt('csv')} className={`px-3 py-1.5 text-xs font-medium ${fmt === 'csv' ? 'bg-steel-900 text-white' : 'bg-white text-steel-600 hover:bg-steel-50'}`}>CSV</button>
          </div>
          <button onClick={exp} className="flex items-center gap-1.5 rounded-md bg-steel-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-steel-800"><Download className="h-3.5 w-3.5" />导出 {fmt.toUpperCase()}</button>
        </div>
      </div>
      {sn && <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700"><CheckCheck className="mr-1 inline h-3 w-3" />导出明细 / 页面展示 / 接口返回三者从同一份 store 读取，完全一致</div>}
      <div className="overflow-x-auto rounded-md border border-steel-200">
        <table className="w-full text-left">
          <thead><tr className="bg-steel-100/80">
            {['反查主键','批次号','传感器号','主材料','温度校准','系数','原始系数','改系数原因','状态','下一步处理人','审计历史','三端一致性'].map((h) => <th key={h} className="px-3 py-2 text-xs font-semibold text-steel-600">{h}</th>)}
          </tr></thead>
          <tbody>
            {data.map((r) => (
              <>
                <tr key={r.id} id={`row-${r.id}`} className="border-t border-steel-100 hover:bg-steel-50/60">
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-1">
                      <button onClick={() => cp(r.traceId)} className={`${B} hover:text-amber`}><Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" />{r.traceId}</button>
                      <span className={`inline-flex w-fit items-center rounded px-1.5 py-0.5 text-[9px] font-medium ${r.importBatchId === activeImportBatchId ? 'bg-amber-100 text-amber-700' : 'bg-steel-100 text-steel-500'}`}>{r.importBatchId === activeImportBatchId ? '本次' : '历史'} · {r.importBatchId}</span>
                    </div>
                  </td>
                  <td className={`px-3 py-2 ${M} text-steel-800`}>{r.batchNo}</td>
                  <td className={`px-3 py-2 ${M} text-steel-800`}>{r.sensorNo}</td>
                  <td className={`px-3 py-2 ${M} text-steel-800 max-w-[120px] truncate`}>{r.mainMaterial}</td>
                  <td className={`px-3 py-2 ${M} text-steel-800`}>{r.temperatureCalibration}</td>
                  <td className={`px-3 py-2 ${M} text-steel-800`}>{r.coefficient}</td>
                  <td className={`px-3 py-2 ${M} text-steel-800`}>{r.originalCoefficient ?? '-'}</td>
                  <td className={`px-3 py-2 ${M} text-steel-800 max-w-[120px] truncate`}>{r.coefficientChangeReason ?? '-'}</td>
                  <td className="px-3 py-2"><span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[r.status]}`}>{STATUS_LABELS[r.status]}</span></td>
                  <td className="px-3 py-2">{r.nextHandler ? <span className="inline-flex items-center gap-0.5 rounded border border-steel-200 bg-steel-50 px-1.5 py-0.5 text-[10px] font-medium text-steel-700"><User className="h-2.5 w-2.5" />{NEXT_HANDLER_LABELS[r.nextHandler]}</span> : <span className="text-[10px] text-steel-400">-</span>}</td>
                  <td className="px-3 py-2"><button onClick={() => toggle(r.id)} className={`${B}`}><History className="h-2.5 w-2.5" />{r.audits.length} 次{ea.has(r.id) ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}</button></td>
                  <td className="px-3 py-2">{badge(r)}</td>
                </tr>
                {ea.has(r.id) && (
                  <tr className="bg-steel-50/80"><td colSpan={12} className="px-3 py-2"><div className="space-y-1 pl-8">
                    {r.audits.map((a) => (
                      <div key={a.id} className="flex items-start gap-2 rounded bg-white px-2 py-1.5 border border-steel-100">
                        <span className={`rounded px-1 py-0.5 text-[9px] font-medium border ${ACTION_COLORS[a.action]}`}>{ACTION_LABELS[a.action]}</span>
                        <span className={`${M} text-[10px] text-steel-500`}>{a.changedAt}</span>
                        <span className="text-[10px] text-steel-600"><span className="font-medium text-steel-800">{a.changedByName}</span> 修改「{a.field}」：{a.oldValue !== null && <span className={`${M} text-red-600 line-through`}>{String(a.oldValue)} </span>}<ArrowRight className="inline h-2.5 w-2.5 text-steel-400 mx-0.5" /><span className={`${M} text-emerald-700`}>{String(a.newValue)}</span>{a.reason && <span className="text-steel-500 ml-1">（{a.reason}）</span>}</span>
                      </div>
                    ))}
                  </div></td></tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ConsistencySection() {
  const records = useStore((s) => s.records)
  const getExportData = useStore((s) => s.getExportData)
  const getApiReturnData = useStore((s) => s.getApiReturnData)
  const ed = useMemo(() => getExportData(), [getExportData])
  const ad = useMemo(() => getApiReturnData(), [getApiReturnData])
  const kf = ['status', 'coefficient', 'nextHandler', 'coefficientChangeReason'] as const
  const fl: Record<string, string> = { status: '状态', coefficient: '系数', nextHandler: '下一步处理人', coefficientChangeReason: '改系数原因' }
  const cmp = useMemo(() => records.map((p) => {
    const e = ed.find((r) => r.id === p.id); const a = ad.find((r) => r.id === p.id)
    const diffs: string[] = []
    kf.forEach((f) => { const ev = String(e?.[f] ?? ''); const pv = String(p[f] ?? ''); const av = String(a?.[f] ?? ''); if (!(ev === pv && pv === av)) diffs.push(`${fl[f]}：导出=${ev} / 页面=${pv} / 接口=${av}`) })
    const fg = p.originalCoefficient !== null && p.coefficientChangeReason === null
    return { id: p.id, traceId: p.traceId, p, e, a, ok: diffs.length === 0, diffs, fg }
  }), [records, ed, ad])
  const okAll = cmp.every((c) => c.ok)
  return (
    <section className={S}>
      <div className="flex items-center justify-between mb-4">
        <h2 className={H}><Layers className="h-5 w-5 text-amber" />一致性校验</h2>
        {okAll && <span className="inline-flex items-center gap-1 rounded-full bg-emerald px-3 py-1 text-xs font-semibold text-white"><CheckCircle2 className="h-3.5 w-3.5" />三端一致</span>}
      </div>
      <div className="overflow-x-auto rounded-md border border-steel-200">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-steel-100/80">
              <th className="px-3 py-2 text-xs font-semibold text-steel-600" rowSpan={2}>反查主键</th>
              {kf.map((f) => <th key={f} className="px-2 py-2 text-center text-xs font-semibold text-steel-600" colSpan={3}>{fl[f]}</th>)}
            </tr>
            <tr className="border-t border-steel-200 bg-steel-50/50">
              {kf.flatMap((f) => ['导出明细','页面展示','接口返回'].map((t, i) => <th key={`${f}-${i}`} className="px-1.5 py-1 text-center text-[10px] font-semibold text-steel-500">{t}</th>))}
            </tr>
          </thead>
          <tbody>
            {cmp.map(({ id, traceId, p, e, a, ok, diffs, fg }) => (
              <tr key={id} id={`cons-row-${id}`} className={`border-t border-steel-100 ${!ok ? 'bg-red-50' : fg ? 'bg-amber-50 font-bold' : 'hover:bg-steel-50/60'}`}>
                <td className="px-3 py-2">
                  <button onClick={() => cp(traceId)} className={`${B} hover:text-amber`}><Link2 className="h-2.5 w-2.5" />{traceId}</button>
                  {!ok && diffs.length > 0 && <div className="mt-1 space-y-0.5">{diffs.map((d, i) => <p key={i} className="text-[9px] text-red-600 font-normal">{d}</p>)}</div>}
                  {fg && <p className="mt-1 text-[9px] text-amber-700 font-normal">⚠ 人工改系数无原因 → 三端均应显示异常，不得在任一端消失</p>}
                </td>
                {kf.map((f) => {
                  const vs = [String(e?.[f] ?? '-'), String(p[f] ?? '-'), String(a?.[f] ?? '-')]
                  const same = vs[0] === vs[1] && vs[1] === vs[2]
                  return <>{vs.map((v, i) => <td key={`${f}-${i}`} className={`px-1.5 py-2 ${!same ? 'bg-red-100/50' : ''}`}>
                    <div className="flex items-center gap-1">
                      <span className={`${M} text-[10px] text-steel-800`}>{v}</span>
                      {same && i === 2 && <CheckCircle2 className="h-3 w-3 text-emerald flex-shrink-0" />}
                      {!same && i === 2 && <XCircle className="h-3 w-3 text-red-500 flex-shrink-0" />}
                    </div>
                  </td>)}</>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!okAll && <p className="mt-3 text-xs text-red-600">存在三端数据不一致的记录（红色高亮），请检查</p>}
    </section>
  )
}

function ReportSection() {
  const getReportData = useStore((s) => s.getReportData)
  const records = useStore((s) => s.records)
  const rd = useMemo(() => getReportData(), [getReportData])
  const st = useMemo(() => {
    const dm = new Map<string, number>(); records.forEach((r) => { const k = `${r.batchNo}-${r.sensorNo}`; dm.set(k, (dm.get(k) || 0) + 1) })
    return { t: records.length, c: records.filter((r) => r.status === 'conflict').length, p: records.filter((r) => r.status === 'pending_review').length, rv: records.filter((r) => r.status === 'reviewed').length, d: [...dm.values()].filter((x) => x > 1).length }
  }, [records])
  const SC = ({ icon: I, l, v, cl }: { icon: any; l: string; v: number; cl: string }) => (
    <div className={`rounded-lg border border-steel-200 bg-white p-3 ${cl}`}><div className="flex items-center gap-2"><div className="rounded-md bg-steel-50 p-1.5"><I className="h-4 w-4" /></div><div><p className="text-[10px] text-steel-500">{l}</p><p className={`${M} text-lg font-bold`}>{v}</p></div></div></div>
  )
  return (
    <section className={S}>
      <div className="mb-4"><h2 className={H}><FileBarChart className="h-5 w-5 text-amber" />报告与反查</h2></div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SC icon={Layers} l="总记录数" v={st.t} cl="text-steel-700" />
        <SC icon={AlertTriangle} l="冲突数" v={st.c} cl="text-red-600" />
        <SC icon={XCircle} l="待复核数" v={st.p} cl="text-amber" />
        <SC icon={CheckCircle2} l="已复核数" v={st.rv} cl="text-emerald" />
        <SC icon={Layers} l="重复组合数" v={st.d} cl="text-steel-700" />
      </div>
      <div className="space-y-3">
        {rd.map((r) => (
          <div key={r.id} className="rounded-lg border border-steel-200 bg-white p-4">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => cp(r.traceId)} className={`${B} hover:border-amber`}><Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" />traceId: {r.traceId}</button>
                <button onClick={() => cp(r.importBatchId)} className={`${B} hover:border-amber`}><Copy className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100" />批次: {r.importBatchId}</button>
                <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[r.status]}`}>{STATUS_LABELS[r.status]}</span>
              </div>
              <span className={`${M} text-[10px] text-steel-400`}>导入 {r.importedAt} · 更新 {r.updatedAt}</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-xs text-steel-700"><span className="font-semibold text-steel-900">温度校准 vs 备注：</span>
                  <span className={`ml-1 ${M} ${r.sensorNote.includes(r.temperatureCalibration.replace('°C', '')) ? 'text-emerald-700' : 'text-red-600'}`}>{r.temperatureCalibration}</span>
                  <span className="mx-1 text-steel-400">↔</span><span className="text-steel-600">{r.sensorNote.slice(0, 40)}...</span>
                </p>
                <p className="text-xs text-steel-700"><span className="font-semibold text-steel-900">系数变更：</span>
                  {r.originalCoefficient !== null ? (<><span className={`${M} text-red-600 line-through ml-1`}>{r.originalCoefficient}</span><ArrowRight className="mx-1 inline h-2.5 w-2.5 text-steel-400" /><span className={`${M} text-emerald-700`}>{r.coefficient}</span><span className="ml-1 text-steel-500">原因：{r.coefficientChangeReason || <span className="text-amber">未填写</span>}</span></>) : <span className={`ml-1 ${M} text-steel-600`}>{r.coefficient}（未修改）</span>}
                </p>
                {r.curve?.calculationDetail && <p className="text-xs text-steel-600"><span className="font-semibold text-steel-900">计算明细：</span><span className={`ml-1 ${M} text-[10px] text-steel-500`}>{r.curve.calculationDetail}</span></p>}
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-steel-700"><span className="font-semibold text-steel-900">下一步找谁：</span>
                  {r.nextHandler ? (<><span className="ml-1 inline-flex items-center gap-0.5 rounded border border-steel-200 bg-steel-50 px-1.5 py-0.5 text-[10px] font-medium text-steel-700"><User className="h-2.5 w-2.5" />{NEXT_HANDLER_LABELS[r.nextHandler]}</span>{r.nextHandlerNote && <span className="ml-1 text-[10px] text-amber-700">理由：{r.nextHandlerNote}</span>}</>) : <span className="ml-1 text-[10px] text-steel-400">无待办</span>}
                </p>
                <div>
                  <p className="mb-1 text-xs font-semibold text-steel-900">审计时间线（最近3条）：</p>
                  <div className="space-y-1">
                    {r.audits.slice(-3).reverse().map((a) => (<div key={a.id} className="flex items-start gap-1.5 rounded bg-steel-50 px-2 py-1"><span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-medium border ${ACTION_COLORS[a.action]}`}>{ACTION_LABELS[a.action]}</span><span className="text-[10px] text-steel-600 leading-tight"><span className="font-medium text-steel-800">{a.changedByName}</span><span className="text-steel-400"> {a.changedAt.slice(-8)}</span><span className="ml-1">{a.reason || `修改 ${a.field}`}</span></span></div>))}
                    {r.audits.length === 0 && <p className="text-[10px] text-steel-400">无审计记录</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function ExportPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 font-sans">
      <SelfCheckSection /><ExportSection /><ConsistencySection /><ReportSection />
    </div>
  )
}
