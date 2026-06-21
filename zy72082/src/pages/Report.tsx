import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useStore } from '@/store'
import type { AllocationResult, AuditLogEntry } from '@/types'
import { FileBarChart, Download, ChevronDown, ChevronRight, CheckCircle, AlertTriangle, Image as ImageIcon, FileImage } from 'lucide-react'

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
  const { results, calcSteps, records, auditLog, selectedDetailRow, setSelectedDetailRow, exportAuditLog, loadData, addAuditLog } = useStore()
  const [logOpen, setLogOpen] = useState(false)
  const [logFilter, setLogFilter] = useState<AuditCategory>('all')
  const tempChartRef = useRef<SVGSVGElement>(null)
  const effChartRef = useRef<SVGSVGElement>(null)
  const anomalyChartRef = useRef<SVGSVGElement>(null)

  useEffect(() => { loadData() }, [loadData])

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

  const maxTemp = useMemo(() => Math.max(...results.map((r) => Math.abs(r.assignedTemp)), 1), [results])
  const maxEff = useMemo(() => Math.max(...results.map((r) => r.efficiency), 0.01), [results])

  const handleBarClick = useCallback((r: AllocationResult) => setSelectedDetailRow(r.id ?? null), [setSelectedDetailRow])

  const serializeSVG = useCallback((svg: SVGSVGElement): string => {
    const clone = svg.cloneNode(true) as SVGSVGElement
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    const serializer = new XMLSerializer()
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(clone)
  }, [])

  const downloadFile = useCallback((content: string | Blob, filename: string, mime: string) => {
    let blob: Blob
    if (typeof content === 'string') {
      blob = new Blob([content], { type: mime })
    } else {
      blob = content
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const exportChartSVG = useCallback(async (svg: SVGSVGElement | null, name: string) => {
    if (!svg) return
    const svgContent = serializeSVG(svg)
    const ts = new Date().toISOString().replace(/[:.]/g, '-')
    downloadFile(svgContent, `${name}-${ts}.svg`, 'image/svg+xml;charset=utf-8')
    await addAuditLog('report', '导出图表SVG', `${name}.svg`, '')
  }, [serializeSVG, downloadFile, addAuditLog])

  const exportChartPNG = useCallback(async (svg: SVGSVGElement | null, name: string) => {
    if (!svg) return
    const svgContent = serializeSVG(svg)
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(svgBlob)
    const img = new Image()
    img.onload = () => {
      const scale = 2
      const w = svg.viewBox.baseVal.width || svg.clientWidth || 400
      const h = svg.viewBox.baseVal.height || svg.clientHeight || 300
      const canvas = document.createElement('canvas')
      canvas.width = w * scale
      canvas.height = h * scale
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.scale(scale, scale)
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob((blob) => {
          if (blob) {
            const ts = new Date().toISOString().replace(/[:.]/g, '-')
            downloadFile(blob, `${name}-${ts}.png`, 'image/png')
            addAuditLog('report', '导出图表PNG', `${name}.png`, '')
          }
          URL.revokeObjectURL(url)
        }, 'image/png')
      } else {
        URL.revokeObjectURL(url)
      }
    }
    img.onerror = () => { URL.revokeObjectURL(url) }
    img.src = url
  }, [serializeSVG, downloadFile, addAuditLog])

  const exportAllCharts = useCallback(async (fmt: 'svg' | 'png') => {
    const charts: { ref: React.RefObject<SVGSVGElement>; name: string }[] = [
      { ref: tempChartRef, name: 'temperature-chart' },
      { ref: effChartRef, name: 'efficiency-chart' },
      { ref: anomalyChartRef, name: 'anomaly-chart' },
    ]
    for (const c of charts) {
      if (fmt === 'svg') {
        await exportChartSVG(c.ref.current, c.name)
      } else {
        await exportChartPNG(c.ref.current, c.name)
      }
      await new Promise((r) => setTimeout(r, 150))
    }
  }, [exportChartSVG, exportChartPNG])

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

  const chartW = 480
  const chartH = 320
  const padL = 80
  const padR = 60
  const padT = 20
  const padB = 40
  const innerW = chartW - padL - padR
  const innerH = chartH - padT - padB
  const rowH = results.length > 0 ? innerH / results.length : 24

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="section-title">报告导出</h2>
        <div className="flex items-center gap-2">
          <button className="btn-secondary text-xs flex items-center gap-1" onClick={() => exportAllCharts('svg')}>
            <FileImage className="w-3 h-3" />导出全部 SVG
          </button>
          <button className="btn-secondary text-xs flex items-center gap-1" onClick={() => exportAllCharts('png')}>
            <ImageIcon className="w-3 h-3" />导出全部 PNG
          </button>
          <button className="btn-secondary text-xs px-2 py-1" onClick={(e) => { e.stopPropagation(); handleExport() }}>
            <Download className="w-3 h-3 inline mr-1" />导出日志
          </button>
        </div>
      </div>

      {/* 图表区 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 温区分布柱状图 */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="label-text">温区分布柱状图</p>
            <div className="flex items-center gap-1">
              <button className="text-xs text-teal-700 hover:text-teal-900" title="导出 SVG" onClick={() => exportChartSVG(tempChartRef.current, 'temperature-chart')}>
                <FileImage className="w-3 h-3" />
              </button>
              <button className="text-xs text-teal-700 hover:text-teal-900" title="导出 PNG" onClick={() => exportChartPNG(tempChartRef.current, 'temperature-chart')}>
                <ImageIcon className="w-3 h-3" />
              </button>
            </div>
          </div>
          <svg ref={tempChartRef} viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto">
            <rect x="0" y="0" width={chartW} height={chartH} fill="#ffffff" />
            {results.map((r, i) => {
              const y = padT + i * rowH + 2
              const h = Math.max(rowH - 6, 4)
              const ratio = Math.min(Math.abs(r.assignedTemp) / maxTemp, 1)
              const barW = ratio * (innerW - 50)
              const isSel = r.id === selectedDetailRow
              return (
                <g key={r.id} className="cursor-pointer" onClick={() => handleBarClick(r)}>
                  <text x={padL - 6} y={y + h / 2 + 4} textAnchor="end" fontSize="10" fill="#64748b">{r.routeId}/{r.warehouseId}</text>
                  <rect x={padL} y={y} width={innerW - 50} height={h} fill="#f1f5f9" rx="3" />
                  <rect x={padL} y={y} width={barW} height={h} fill={isSel ? '#0f766e' : '#0F4C5C'} rx="3" />
                  <text x={padL + innerW - 45} y={y + h / 2 + 4} fontSize="10" fill="#334155">{r.assignedTemp}°C</text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* 路线效率散点图 */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="label-text">路线效率散点图</p>
            <div className="flex items-center gap-1">
              <button className="text-xs text-teal-700 hover:text-teal-900" title="导出 SVG" onClick={() => exportChartSVG(effChartRef.current, 'efficiency-chart')}>
                <FileImage className="w-3 h-3" />
              </button>
              <button className="text-xs text-teal-700 hover:text-teal-900" title="导出 PNG" onClick={() => exportChartPNG(effChartRef.current, 'efficiency-chart')}>
                <ImageIcon className="w-3 h-3" />
              </button>
            </div>
          </div>
          <svg ref={effChartRef} viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto">
            <rect x="0" y="0" width={chartW} height={chartH} fill="#ffffff" />
            <line x1={padL} y1={chartH - padB} x2={chartW - padR} y2={chartH - padB} stroke="#e2e8f0" strokeWidth="1" />
            {results.map((r, i) => {
              const y = padT + i * rowH + rowH / 2
              const ratio = Math.min(r.efficiency / maxEff, 1)
              const x = padL + ratio * (innerW - 20)
              const isSel = r.id === selectedDetailRow
              return (
                <g key={r.id} className="cursor-pointer" onClick={() => handleBarClick(r)}>
                  <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#64748b">{r.routeId}</text>
                  <circle cx={x} cy={y} r={isSel ? 7 : 5} fill={isSel ? '#0f766e' : '#0F766E'} stroke="#ffffff" strokeWidth="2" />
                  <text x={padL + innerW - 45} y={y + 4} fontSize="10" fill="#334155">{r.efficiency.toFixed(2)}</text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* 异常分布统计 */}
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="label-text">异常分布统计</p>
            <div className="flex items-center gap-1">
              <button className="text-xs text-teal-700 hover:text-teal-900" title="导出 SVG" onClick={() => exportChartSVG(anomalyChartRef.current, 'anomaly-chart')}>
                <FileImage className="w-3 h-3" />
              </button>
              <button className="text-xs text-teal-700 hover:text-teal-900" title="导出 PNG" onClick={() => exportChartPNG(anomalyChartRef.current, 'anomaly-chart')}>
                <ImageIcon className="w-3 h-3" />
              </button>
            </div>
          </div>
          <svg ref={anomalyChartRef} viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-auto">
            <rect x="0" y="0" width={chartW} height={chartH} fill="#ffffff" />
            {(() => {
              const total = results.length || 1
              const normRatio = normalCount / total
              const anomRatio = anomalyCount / total
              const barX = 60
              const barY = 80
              const barW = chartW - 120
              const barH = 80
              const normW = normRatio * barW
              const anomW = anomRatio * barW
              return (
                <>
                  <g className="cursor-pointer" onClick={() => setSelectedDetailRow(null)}>
                    <rect x={barX} y={barY} width={normW} height={barH} fill="#0F4C5C" rx="6" />
                    <text x={barX + normW / 2} y={barY + barH / 2 - 2} textAnchor="middle" fontSize="28" fontWeight="bold" fill="#ffffff">{normalCount}</text>
                    <text x={barX + normW / 2} y={barY + barH / 2 + 22} textAnchor="middle" fontSize="12" fill="#ffffff">正常</text>
                  </g>
                  <g className="cursor-pointer" onClick={() => setSelectedDetailRow(null)}>
                    <rect x={barX + normW} y={barY} width={anomW} height={barH} fill="#E36414" rx="6" />
                    <text x={barX + normW + anomW / 2} y={barY + barH / 2 - 2} textAnchor="middle" fontSize="28" fontWeight="bold" fill="#ffffff">{anomalyCount}</text>
                    <text x={barX + normW + anomW / 2} y={barY + barH / 2 + 22} textAnchor="middle" fontSize="12" fill="#ffffff">异常</text>
                  </g>
                  <text x={chartW / 2} y={barY + barH + 36} textAnchor="middle" fontSize="14" fill="#475569">
                    共 {results.length} 条分配结果 — 正常 {normalCount} 条，异常 {anomalyCount} 条
                  </text>
                </>
              )
            })()}
          </svg>
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
