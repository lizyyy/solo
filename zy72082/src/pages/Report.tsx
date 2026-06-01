import { useState, useMemo, useCallback } from 'react'
import { useStore } from '@/store'
import type { AllocationResult, AuditLogEntry } from '@/types'
import { FileBarChart, Download, ChevronDown, ChevronRight, CheckCircle, AlertTriangle } from 'lucide-react'

type AuditCategory = AuditLogEntry['category'] | 'all'
const CATEGORIES: { key: AuditCategory; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'data', label: '数据' },
  { key: 'parameter', label: '参数' },
  { key: 'calculation', label: '计算' },
  { key: 'conflict', label: '冲突' },
  { key: 'report', label: '报告' },
]

export default function Report() {
  const { results, calcSteps, records, auditLog, selectedDetailRow, setSelectedDetailRow, exportAuditLog, loadData } = useStore()
  const [logOpen, setLogOpen] = useState(false)
  const [logFilter, setLogFilter] = useState<AuditCategory>('all')

  useState(() => { loadData() })

  const anomalyCount = useMemo(() => {
    const ids = new Set(calcSteps.filter((s) => s.isAnomaly).map((s) => s.resultId))
    return results.filter((r) => ids.has(r.id!)).length
  }, [results, calcSteps])

  const normalCount = results.length - anomalyCount

  const selectedResult = useMemo(
    () => results.find((r) => r.id === selectedDetailRow),
    [results, selectedDetailRow]
  )
  const selectedSteps = useMemo(
    () => calcSteps.filter((s) => s.resultId === selectedDetailRow),
    [calcSteps, selectedDetailRow]
  )

  const consistencyChecks = useMemo(() => {
    const checks: { label: string; pass: boolean; detail?: string }[] = []
    if (results.length === 0) return checks
    const totalLoad = results.reduce((s, r) => s + r.assignedLoad, 0)
    const recordTotalCap = records.reduce((s, r) => s + r.vehicleCapacity, 0)
    const loadMatch = Math.abs(totalLoad - recordTotalCap) < 0.01
    checks.push({ label: '分配载重合计与记录总容量一致', pass: loadMatch, detail: loadMatch ? undefined : `差异: ${(totalLoad - recordTotalCap).toFixed(2)}` })
    const negEff = results.some((r) => r.efficiency < 0)
    checks.push({ label: '效率值无负数', pass: !negEff, detail: negEff ? '存在负效率值' : undefined })
    return checks
  }, [results, records])

  const filteredLog = useMemo(
    () => (logFilter === 'all' ? auditLog : auditLog.filter((e) => e.category === logFilter)),
    [auditLog, logFilter]
  )

  const handleExport = useCallback(() => {
    const logs = exportAuditLog()
    const text = logs.map((l) => `[${l.timestamp}] [${l.category}] ${l.action}: ${l.detail}`).join('\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }, [exportAuditLog])

  const maxTemp = useMemo(() => Math.max(...results.map((r) => r.assignedTemp), 1), [results])
  const maxEff = useMemo(() => Math.max(...results.map((r) => r.efficiency), 0.01), [results])

  const handleBarClick = useCallback((r: AllocationResult) => setSelectedDetailRow(r.id ?? null), [setSelectedDetailRow])

  if (results.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <FileBarChart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">暂无分配结果，请先完成路线分配</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="section-title">报告导出</h2>

      {/* 图表区 */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="label-text mb-3">温区分布柱状图</p>
          <div className="space-y-2">
            {results.map((r) => (
              <div key={r.id} className="flex items-center gap-2 cursor-pointer" onClick={() => handleBarClick(r)}>
                <span className="text-xs text-slate-500 w-24 truncate">{r.routeId}/{r.warehouseId}</span>
                <div className="flex-1 bg-slate-100 rounded h-5 relative">
                  <div className="bg-teal-950 h-5 rounded transition-all" style={{ width: `${(r.assignedTemp / maxTemp) * 100}%` }} />
                </div>
                <span className="data-cell text-xs w-14 text-right">{r.assignedTemp}°C</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <p className="label-text mb-3">路线效率散点图</p>
          <div className="space-y-2">
            {results.map((r) => (
              <div key={r.id} className="flex items-center gap-2 cursor-pointer" onClick={() => handleBarClick(r)}>
                <span className="text-xs text-slate-500 w-24 truncate">{r.routeId}</span>
                <div className="flex-1 relative h-5">
                  <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-teal-700" style={{ left: `${(r.efficiency / maxEff) * 90}%` }} />
                  <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-px bg-slate-200" />
                </div>
                <span className="data-cell text-xs w-14 text-right">{r.efficiency.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <p className="label-text mb-3">异常分布统计</p>
          <div className="flex gap-4 items-center justify-center h-full">
            <div className="text-center cursor-pointer" onClick={() => setSelectedDetailRow(null)}>
              <p className="text-3xl font-bold text-teal-950">{normalCount}</p>
              <span className="badge-info mt-1">正常</span>
            </div>
            <div className="text-center cursor-pointer" onClick={() => setSelectedDetailRow(null)}>
              <p className="text-3xl font-bold text-amber-600">{anomalyCount}</p>
              <span className="badge-warning mt-1">异常</span>
            </div>
          </div>
        </div>
      </div>

      {/* 明细表 */}
      <div className="card p-4">
        <p className="label-text mb-3">分配明细</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-150">
                {['路线ID', '仓库ID', '车辆ID', '分配温度', '分配里程', '载重', '效率'].map((h) => (
                  <th key={h} className="text-left py-2 px-3 label-text">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-slate-100 cursor-pointer transition-colors ${r.id === selectedDetailRow ? 'bg-teal-100' : 'hover:bg-slate-50'}`}
                  onClick={() => setSelectedDetailRow(r.id === selectedDetailRow ? null : r.id!)}
                >
                  <td className="py-2 px-3 data-cell">{r.routeId}</td>
                  <td className="py-2 px-3 data-cell">{r.warehouseId}</td>
                  <td className="py-2 px-3 data-cell">{r.vehicleId}</td>
                  <td className="py-2 px-3 data-cell">{r.assignedTemp}°C</td>
                  <td className="py-2 px-3 data-cell">{r.assignedMileage}km</td>
                  <td className="py-2 px-3 data-cell">{r.assignedLoad}t</td>
                  <td className="py-2 px-3 data-cell">{r.efficiency.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {selectedResult && selectedSteps.length > 0 && (
          <div className="mt-4 p-3 bg-teal-50 rounded-lg">
            <p className="label-text mb-2">计算追溯 — {selectedResult.routeId}/{selectedResult.warehouseId}</p>
            {selectedSteps.map((s) => (
              <div key={s.id} className="text-xs mb-2">
                <p className="font-medium text-navy-950">{s.description}</p>
                <p className="text-slate-500">输入: {s.inputValues}</p>
                <p className="text-slate-500">输出: {s.outputValues}</p>
                {s.isAnomaly && <p className="text-amber-600">异常: {s.anomalyReason}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 一致性校验面板 */}
      <div className="card p-4">
        <p className="label-text mb-3">一致性校验</p>
        {consistencyChecks.length === 0 ? (
          <p className="text-sm text-slate-400">无数据可校验</p>
        ) : (
          <div className="space-y-2">
            {consistencyChecks.map((c, i) => (
              <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded ${c.pass ? '' : 'bg-amber-100'}`}>
                {c.pass ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
                <span className="text-sm">{c.label}</span>
                <span className={c.pass ? 'badge-success' : 'badge-warning'}>{c.pass ? '通过' : '警告'}</span>
                {c.detail && <span className="text-xs text-amber-600">{c.detail}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 审计日志 */}
      <div className="card p-4">
        <div className="flex items-center justify-between cursor-pointer" onClick={() => setLogOpen(!logOpen)}>
          <p className="label-text">审计日志 ({auditLog.length})</p>
          <div className="flex items-center gap-2">
            <button className="btn-secondary text-xs px-2 py-1" onClick={(e) => { e.stopPropagation(); handleExport() }}>
              <Download className="w-3 h-3 inline mr-1" />导出日志
            </button>
            {logOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
          </div>
        </div>
        {logOpen && (
          <div className="mt-3">
            <div className="flex gap-1 mb-3">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  className={`text-xs px-2 py-1 rounded ${logFilter === c.key ? 'bg-teal-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  onClick={() => setLogFilter(c.key)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredLog.map((e) => (
                <div key={e.id} className="flex items-start gap-3 text-xs py-1.5 border-b border-slate-50">
                  <span className="text-slate-400 whitespace-nowrap">{new Date(e.timestamp).toLocaleString('zh-CN')}</span>
                  <span className={`badge ${e.category === 'conflict' ? 'badge-warning' : 'badge-info'}`}>{e.category}</span>
                  <span className="font-medium text-navy-950">{e.action}</span>
                  <span className="text-slate-500 flex-1 truncate">{e.detail}</span>
                </div>
              ))}
              {filteredLog.length === 0 && <p className="text-slate-400 text-center py-4">暂无日志</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
