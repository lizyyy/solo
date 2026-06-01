import { useState } from 'react'
import {
  FileText, Download, GitCompare, PlusCircle,
  CheckCircle2, AlertTriangle, XCircle, Clock, Trash2,
} from 'lucide-react'
import { useStore } from '@/store'
import type { DiagnosisReport, DiagnosisLevel } from '@/types'

function LevelBadge({ level }: { level: DiagnosisLevel }) {
  const config = {
    safe: { cls: 'badge-safe', icon: CheckCircle2, text: '安全' },
    warn: { cls: 'badge-warn', icon: AlertTriangle, text: '确认' },
    danger: { cls: 'badge-danger', icon: XCircle, text: '危险' },
  }
  const c = config[level]
  return (
    <span className={`${c.cls} inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border`}>
      <c.icon className="w-3 h-3" />
      {c.text}
    </span>
  )
}

function ReportCard({ report, onDelete }: { report: DiagnosisReport; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false)

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `swd-report-${report.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="card">
      <div className="card-header cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-gray-200 font-mono-data">{report.id.slice(0, 16)}</span>
          </div>
          <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded font-mono-data">阈值 v{report.thresholdVersion}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-400 font-mono-data">{report.summary.safe}</span>
            <span className="text-amber-400 font-mono-data">{report.summary.warn}</span>
            <span className="text-red-400 font-mono-data">{report.summary.danger}</span>
          </div>
          <span className="text-[10px] text-gray-500">{new Date(report.createdAt).toLocaleString('zh-CN')}</span>
          <button onClick={e => { e.stopPropagation(); handleExport() }} className="btn-secondary text-[10px] px-2 py-1 flex items-center gap-1">
            <Download className="w-3 h-3" /> JSON
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete() }} className="btn-secondary text-[10px] px-2 py-1 text-red-400 flex items-center gap-1">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="card-body space-y-4">
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-[#0D1B30] rounded-lg p-3">
              <div className="text-gray-500 mb-1">房间尺寸</div>
              <div className="font-mono-data text-gray-300">
                {report.roomDimensions.length}m × {report.roomDimensions.width}m × {report.roomDimensions.height}m
              </div>
            </div>
            <div className="bg-[#0D1B30] rounded-lg p-3">
              <div className="text-gray-500 mb-1">采样缺口</div>
              <div className="font-mono-data text-gray-300">{report.gapIntervals.length} 处</div>
            </div>
            <div className="bg-[#0D1B30] rounded-lg p-3">
              <div className="text-gray-500 mb-1">判定汇总</div>
              <div className="font-mono-data">
                <span className="text-emerald-400">{report.summary.safe} 安全 </span>
                <span className="text-amber-400">{report.summary.warn} 确认 </span>
                <span className="text-red-400">{report.summary.danger} 危险</span>
              </div>
            </div>
          </div>

          {report.modes.length > 0 && (
            <div>
              <h3 className="text-xs text-gray-500 mb-2">驻波模态</h3>
              <div className="flex flex-wrap gap-2">
                {report.modes.slice(0, 12).map((m, i) => (
                  <span key={i} className="text-[10px] font-mono-data bg-gray-800/60 text-gray-400 px-2 py-0.5 rounded">
                    {m.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-xs text-gray-500 mb-2">逐条诊断</h3>
            <div className="space-y-1.5">
              {report.results.map(r => (
                <div
                  key={r.id}
                  className={`rounded border-l-3 pl-3 pr-2 py-1.5 ${
                    r.level === 'safe' ? 'bg-emerald-500/5 border-l-emerald-500' :
                    r.level === 'warn' ? 'bg-amber-500/5 border-l-amber-500' :
                    'bg-red-500/5 border-l-red-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <LevelBadge level={r.level} />
                      <span className="font-mono-data text-xs text-gray-300">{r.frequency} Hz</span>
                    </div>
                    <span className="font-mono-data text-[10px] text-gray-500">
                      {r.convertedValue.toFixed(2)} {r.convertedUnit} | 阈值 v{r.thresholdVersion}
                    </span>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-0.5">{r.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ReportCompare() {
  const reports = useStore(s => s.reports)
  const [r1Id, setR1Id] = useState('')
  const [r2Id, setR2Id] = useState('')

  if (reports.length < 2) return null

  const r1 = reports.find(r => r.id === r1Id)
  const r2 = reports.find(r => r.id === r2Id)

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <GitCompare className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-gray-200">报告并排对比</h2>
        </div>
      </div>
      <div className="card-body space-y-3">
        <div className="flex gap-3">
          <select className="input-field flex-1 text-xs" value={r1Id} onChange={e => setR1Id(e.target.value)}>
            <option value="">选择报告 A</option>
            {reports.map(r => <option key={r.id} value={r.id}>{r.id.slice(0, 16)} (v{r.thresholdVersion})</option>)}
          </select>
          <span className="text-gray-500 self-center text-xs">vs</span>
          <select className="input-field flex-1 text-xs" value={r2Id} onChange={e => setR2Id(e.target.value)}>
            <option value="">选择报告 B</option>
            {reports.map(r => <option key={r.id} value={r.id}>{r.id.slice(0, 16)} (v{r.thresholdVersion})</option>)}
          </select>
        </div>

        {r1 && r2 && (
          <div className="grid grid-cols-2 gap-4">
            {([r1, r2] as const).map((report, idx) => (
              <div key={idx} className="bg-[#0D1B30] rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-200 font-mono-data">{report.id.slice(0, 16)}</span>
                  <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-0.5 rounded">阈值 v{report.thresholdVersion}</span>
                </div>
                <div className="text-xs text-gray-400">
                  <div>房间：{report.roomDimensions.length}m × {report.roomDimensions.width}m × {report.roomDimensions.height}m</div>
                  <div className="mt-1">
                    判定：
                    <span className="text-emerald-400 font-mono-data"> {report.summary.safe} 安全</span>
                    <span className="text-amber-400 font-mono-data"> {report.summary.warn} 确认</span>
                    <span className="text-red-400 font-mono-data"> {report.summary.danger} 危险</span>
                  </div>
                  <div className="mt-1">缺口：{report.gapIntervals.length} 处</div>
                </div>
                <div className="space-y-1">
                  {report.results.map(r => (
                    <div key={r.id} className="flex items-center justify-between text-[10px]">
                      <span className="font-mono-data text-gray-400">{r.frequency} Hz</span>
                      <LevelBadge level={r.level} />
                      <span className="font-mono-data text-gray-500">{r.convertedValue.toFixed(1)} {r.convertedUnit}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SupplementInput() {
  const supplementLog = useStore(s => s.supplementLog)
  const [text, setText] = useState('')

  const handleSupplement = () => {
    if (text.trim()) {
      supplementLog(text)
      setText('')
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center gap-2">
          <PlusCircle className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-gray-200">补录旧口径数据</h2>
        </div>
        <span className="text-[10px] text-amber-400/80 border border-amber-500/30 px-2 py-0.5 rounded">数据来源：补录</span>
      </div>
      <div className="card-body space-y-3">
        <textarea
          className="input-field w-full h-24 resize-none font-mono-data text-xs"
          placeholder="粘贴传感器日志（补录数据将标记为 supplement 来源）"
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <button onClick={handleSupplement} disabled={!text.trim()} className="btn-primary text-xs flex items-center gap-1.5">
          <PlusCircle className="w-3.5 h-3.5" /> 补录数据
        </button>
      </div>
    </div>
  )
}

export default function Reports() {
  const reports = useStore(s => s.reports)
  const deleteReport = useStore(s => s.deleteReport)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-100">报告与历史</h1>
        <p className="text-xs text-gray-500 mt-1">诊断报告查看、导出、历史对比、补录旧口径数据</p>
      </div>

      <SupplementInput />

      {reports.length === 0 ? (
        <div className="card">
          <div className="card-body text-center text-gray-500 text-sm py-12">
            <Clock className="w-8 h-8 mx-auto mb-2 text-gray-700" />
            暂无诊断报告，请先在诊断看板页运行诊断
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map(report => (
            <ReportCard key={report.id} report={report} onDelete={() => deleteReport(report.id)} />
          ))}
        </div>
      )}

      <ReportCompare />
    </div>
  )
}
