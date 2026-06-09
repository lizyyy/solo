import { useState, useCallback, useMemo } from 'react'
import { Upload, FileText, CheckCircle, AlertTriangle, ArrowRight, Clock, Download, History, User, Edit2, Save, X, PieChart, List } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { parseCSV, parseJSON } from '@/utils/csvParser'
import { cn } from '@/lib/utils'
import type { BoundaryStatus, BoundaryRecord, Role } from '@/types'

const DEMO_CSV = `姓名,数学,语文,英语,综合评价,竞赛得分,竞赛分母
张三,85,90,78,3.5,120,0
李四,92,88,95,4.2,,0
王五,76,82,89,3.8,95,15
赵六,88,95,91,4.5,110,0
钱七,79,,86,3.2,85,20
孙八,94,91,87,4.0,,0`

function FileUploadZone({ onFileReady }: { onFileReady: (text: string, name: string, ext: string) => void }) {
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (ext !== 'csv' && ext !== 'json') return
    const reader = new FileReader()
    reader.onload = () => onFileReady(reader.result as string, file.name, ext)
    reader.readAsText(file)
  }, [onFileReady])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (ext !== 'csv' && ext !== 'json') return
    const reader = new FileReader()
    reader.onload = () => onFileReady(reader.result as string, file.name, ext)
    reader.readAsText(file)
  }, [onFileReady])

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'flex flex-col items-center justify-center gap-4 p-12 rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer',
        dragging ? 'border-amber-500 bg-amber-500/5 scale-[1.01]' : 'border-indigo-600/40 bg-indigo-950/30 hover:border-indigo-500/60'
      )}
      onClick={() => document.getElementById('file-input')?.click()}
    >
      <Upload className={cn('w-10 h-10', dragging ? 'text-amber-400' : 'text-indigo-400/60')} />
      <div className="text-center">
        <p className="text-indigo-100 text-sm font-medium">拖拽 CSV 或 JSON 文件到此处</p>
        <p className="text-indigo-400/50 text-xs mt-1">或点击选择文件</p>
      </div>
      <input id="file-input" type="file" accept=".csv,.json" className="hidden" onChange={handleFileInput} />
    </div>
  )
}

const statusConfig: Record<BoundaryStatus, { label: string; className: string }> = {
  pending_review: { label: '待复核', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  reviewed: { label: '已复核', className: 'bg-blue-500/25 text-blue-300 border-blue-500/30' },
  resolved: { label: '已解决', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
}

const nextActionStyles: Record<string, string> = {
  '找数据复核人': 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25',
  '找竞赛教练唐老师': 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/25',
}

function SummaryStats() {
  const boundaryRecords = useStore(s => s.boundaryRecords)
  const rawData = useStore(s => s.rawData)

  const stats = useMemo(() => ({
    total: boundaryRecords.length,
    pending: boundaryRecords.filter(r => r.status === 'pending_review').length,
    reviewed: boundaryRecords.filter(r => r.status === 'reviewed').length,
    resolved: boundaryRecords.filter(r => r.status === 'resolved').length,
  }), [boundaryRecords])

  if (!rawData) return null

  const cards = [
    { label: '异常总数', value: stats.total, icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: '待复核', value: stats.pending, icon: Clock, color: 'text-orange-400', bg: 'bg-orange-500/10' },
    { label: '已复核', value: stats.reviewed, icon: User, color: 'text-blue-400', bg: 'bg-blue-500/10' },
    { label: '已解决', value: stats.resolved, icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/10' },
  ]

  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map(c => (
        <div key={c.label} className={cn('rounded-lg border border-indigo-800/40 p-3 flex items-center gap-3', c.bg)}>
          <div className={cn('w-10 h-10 rounded-md flex items-center justify-center', c.bg)}>
            <c.icon className={cn('w-5 h-5', c.color)} />
          </div>
          <div>
            <p className="text-indigo-400/60 text-xs">{c.label}</p>
            <p className={cn('text-xl font-bold font-serif', c.color)}>{c.value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

interface ResolveDialogProps {
  record: BoundaryRecord
  onClose: () => void
  onSubmit: (correctedValue: string, reason: string) => void
}

function ResolveDialog({ record, onClose, onSubmit }: ResolveDialogProps) {
  const [correctedValue, setCorrectedValue] = useState(record.currentValue || '')
  const [reason, setReason] = useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl border border-indigo-700/60 bg-indigo-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-indigo-800/50 px-5 py-3">
          <h4 className="font-serif text-lg text-amber-400">解决异常 · 第 {record.rowIndex + 1} 行 · {record.columnName}</h4>
          <button onClick={onClose}><X className="w-5 h-5 text-indigo-400 hover:text-white" /></button>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <p className="text-xs text-indigo-400/60 mb-1">原始值 / 当前值</p>
            <div className="flex gap-3 text-sm">
              <span className="rounded bg-indigo-900/60 px-2 py-1 font-mono text-indigo-300">
                原始：{record.originalValue === '' ? '(空字符串)' : record.originalValue}
              </span>
              <span className="rounded bg-indigo-900/60 px-2 py-1 font-mono text-indigo-300">
                当前：{record.currentValue === '' ? '(空字符串)' : record.currentValue}
              </span>
            </div>
          </div>
          <div>
            <p className="text-xs text-indigo-400/60 mb-1">修正后的值（将写入数值矩阵并影响降维结果）</p>
            <input
              type="number"
              step="any"
              value={correctedValue}
              onChange={e => setCorrectedValue(e.target.value)}
              className="w-full rounded-lg bg-indigo-900/50 border border-indigo-700/50 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              placeholder="请输入修正后的数值"
            />
          </div>
          <div>
            <p className="text-xs text-indigo-400/60 mb-1">处理原因 / 依据</p>
            <textarea
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full resize-none rounded-lg bg-indigo-900/50 border border-indigo-700/50 px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              placeholder="说明为何填入该值、是否与竞赛教练或复核人确认"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-indigo-800/50 px-5 py-3">
          <button onClick={onClose} className="rounded-md border border-indigo-700/50 px-3 py-1.5 text-sm text-indigo-300 hover:bg-indigo-900/50">取消</button>
          <button
            onClick={() => onSubmit(correctedValue, reason.trim())}
            disabled={!reason.trim()}
            className={cn('rounded-md px-3 py-1.5 text-sm transition-colors flex items-center gap-1.5',
              reason.trim() ? 'bg-green-600/80 text-white hover:bg-green-600' : 'bg-gray-600/40 text-gray-400 cursor-not-allowed')}
          >
            <Save className="w-4 h-4" /> 确认解决
          </button>
        </div>
      </div>
    </div>
  )
}

function BoundaryTable() {
  const boundaryRecords = useStore(s => s.boundaryRecords)
  const reviewBoundary = useStore(s => s.reviewBoundary)
  const resolveBoundary = useStore(s => s.resolveBoundary)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  if (boundaryRecords.length === 0) return null

  const resolving = boundaryRecords.find(r => r.id === resolvingId) ?? null

  return (
    <>
      <div className="mt-6">
        <h3 className="font-serif text-lg text-amber-400 mb-3 flex items-center gap-2">
          <List className="w-5 h-5" /> 边界值扫描结果（同一条(行,列)仅生成一条记录）
        </h3>
        <div className="overflow-x-auto rounded-lg border border-indigo-800/40">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-indigo-950/80 text-indigo-300/70 text-xs uppercase tracking-wider">
                <th className="px-3 py-3 text-left font-medium">行号</th>
                <th className="px-3 py-3 text-left font-medium">列名</th>
                <th className="px-3 py-3 text-left font-medium">原值</th>
                <th className="px-3 py-3 text-left font-medium">改后值</th>
                <th className="px-3 py-3 text-left font-medium">分母列</th>
                <th className="px-3 py-3 text-left font-medium">分母值</th>
                <th className="px-3 py-3 text-left font-medium">下一步</th>
                <th className="px-3 py-3 text-left font-medium">状态</th>
                <th className="px-3 py-3 text-left font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-indigo-800/20">
              {boundaryRecords.map(record => {
                const cfg = statusConfig[record.status]
                const needsRole: Role = record.status === 'pending_review' ? '数据复核人' : '竞赛教练唐老师'
                return (
                  <tr key={record.id} className={cn('hover:bg-indigo-900/20 transition-colors', 'border-l-2 border-l-amber-500')}>
                    <td className="px-3 py-3 text-indigo-100 font-mono text-xs">{record.rowIndex + 1}</td>
                    <td className="px-3 py-3 text-indigo-100">{record.columnName}</td>
                    <td className="px-3 py-3 text-indigo-200 font-mono text-xs">{record.originalValue === '' ? '∅' : record.originalValue}</td>
                    <td className="px-3 py-3 font-mono text-xs">
                      {record.status === 'resolved' ? <span className="text-green-400">{record.correctedValue || '∅'}</span> : <span className="text-indigo-400/40">—</span>}
                    </td>
                    <td className="px-3 py-3 text-indigo-300/80">{record.denominatorColumnName}</td>
                    <td className="px-3 py-3 text-indigo-200 font-mono text-xs">{record.denominatorValue}</td>
                    <td className="px-3 py-3">
                      <span className={cn('inline-flex px-2 py-0.5 rounded text-[10px] border', nextActionStyles[record.nextAction])}>
                        <ArrowRight className="w-3 h-3 mr-1" />{record.nextAction}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs border', cfg.className)}>{cfg.label}</span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex gap-2">
                        {record.status === 'pending_review' && (
                          <button
                            onClick={() => reviewBoundary(record.id, needsRole, `已核对：第${record.rowIndex + 1}行「${record.columnName}」/「${record.denominatorColumnName}」确实存在分母为0的空值占位`)}
                            className="px-2.5 py-1 text-xs rounded border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                          >确认复核</button>
                        )}
                        {record.status === 'reviewed' && (
                          <button
                            onClick={() => setResolvingId(record.id)}
                            className="px-2.5 py-1 text-xs rounded border border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors flex items-center gap-1"
                          ><Edit2 className="w-3 h-3" /> 填值解决</button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      {resolving && (
        <ResolveDialog
          record={resolving}
          onClose={() => setResolvingId(null)}
          onSubmit={(cv, rs) => {
            resolveBoundary(resolving.id, '竞赛教练唐老师', cv, rs)
            setResolvingId(null)
          }}
        />
      )}
    </>
  )
}

function AnomalyCards() {
  const boundaryRecords = useStore(s => s.boundaryRecords)
  const anomalyRecords = boundaryRecords.filter(r => r.issueType === 'denominator_zero_empty')
  if (anomalyRecords.length === 0) return null

  return (
    <div className="mt-6">
      <h3 className="font-serif text-lg text-amber-400 mb-3 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5" /> 异常分析卡片（仅展示未解决前的原始说法）
      </h3>
      <div className="grid gap-4">
        {anomalyRecords.map(record => (
          <div key={record.id} className={cn('rounded-lg border border-amber-500/20 bg-indigo-950/60 p-4 border-l-[3px] border-l-amber-500', record.status === 'pending_review' && 'animate-glow')}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="font-serif text-amber-400 text-sm font-semibold">第 {record.rowIndex + 1} 行 · {record.columnName}</h4>
                  <span className={cn('inline-flex px-2 py-0.5 rounded-full text-[10px] border', statusConfig[record.status].className)}>{statusConfig[record.status].label}</span>
                  <span className="text-indigo-400/40 text-[10px]">创建 {record.createdAt}</span>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-indigo-400/60 text-xs font-medium">为什么被留下</span>
                    <p className="text-indigo-200 text-sm mt-0.5 leading-relaxed">{record.reason}</p>
                  </div>
                  <div>
                    <span className="text-indigo-400/60 text-xs font-medium">还缺什么材料</span>
                    <p className="text-indigo-200 text-sm mt-0.5 leading-relaxed">{record.missingMaterial}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <span className="text-indigo-400/60 text-xs font-medium">原值</span>
                    <span className="text-indigo-100 font-mono text-xs bg-indigo-900/60 rounded px-2 py-0.5">{record.originalValue === '' ? '(空字符串)' : record.originalValue}</span>
                    {record.status === 'resolved' && (
                      <>
                        <span className="text-green-400 text-xs font-medium">改后值</span>
                        <span className="text-green-400 font-mono text-xs bg-green-500/10 border border-green-500/30 rounded px-2 py-0.5">{record.correctedValue === '' ? '(空)' : record.correctedValue}</span>
                      </>
                    )}
                  </div>
                </div>
                {record.history.length > 0 && (
                  <div className="mt-3 border-t border-indigo-800/30 pt-3">
                    <p className="text-indigo-400/60 text-xs font-medium mb-2 flex items-center gap-1"><History className="w-3 h-3" /> 处理历史</p>
                    <ol className="space-y-1.5">
                      {record.history.map((h, i) => (
                        <li key={i} className="flex items-start gap-2 text-[11px]">
                          <span className="text-indigo-400/40 shrink-0 w-[78px]">{h.timestamp}</span>
                          <span className={cn('shrink-0 rounded px-1.5 py-0.5 border',
                            h.action === '创建' ? 'bg-indigo-800/40 text-indigo-300 border-indigo-700/40' :
                            h.action === '复核' ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' :
                            'bg-green-500/15 text-green-300 border-green-500/30')}>{h.action}</span>
                          <span className="text-indigo-300/80 shrink-0">{h.role}</span>
                          <span className="text-indigo-200/80">{h.description}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
              <button className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors shrink-0', nextActionStyles[record.nextAction] ?? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30')}>
                <ArrowRight className="w-3.5 h-3.5" />{record.nextAction}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ExportButton() {
  const rawData = useStore(s => s.rawData)
  const boundaryRecords = useStore(s => s.boundaryRecords)
  const weights = useStore(s => s.weights)
  const svdResult = useStore(s => s.svdResult)

  if (!rawData) return null

  const handleExport = () => {
    const payload = {
      exportedAt: new Date().toLocaleString('zh-CN'),
      fileName: rawData.fileName,
      columns: rawData.headers.map((h, i) => ({ name: h, type: rawData.columnTypes[i], weight: weights[i]?.weight })),
      boundaryRecords: boundaryRecords.map(r => ({
        row: r.rowIndex + 1, column: r.columnName, denominator: r.denominatorColumnName,
        originalValue: r.originalValue, correctedValue: r.correctedValue,
        status: r.status, nextAction: r.nextAction, resolvedReason: r.resolvedReason,
        history: r.history,
      })),
      svd: svdResult ? {
        singularValues: svdResult.singularValues,
        explainedVarianceRatio: svdResult.explainedVarianceRatio,
      } : null,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `奇异值降维报告-${rawData.fileName.replace(/\.[^.]+$/, '')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/30 bg-indigo-900/30 text-indigo-300 text-sm hover:bg-indigo-800/40 transition-colors">
      <Download className="w-4 h-4" /> 导出报告
    </button>
  )
}

export default function ImportPage() {
  const rawData = useStore(s => s.rawData)
  const importParsed = useStore(s => s.importParsed)

  const handleFileReady = useCallback((text: string, name: string, ext: string) => {
    let parsed: { headers: string[]; rows: string[][] }
    if (ext === 'json') parsed = parseJSON(text)
    else parsed = parseCSV(text)
    if (parsed.headers.length === 0) return
    importParsed(name, parsed.headers, parsed.rows)
  }, [importParsed])

  const handleDemoData = useCallback(() => handleFileReady(DEMO_CSV, '示例数据.csv', 'csv'), [handleFileReady])

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl text-amber-400 font-bold flex items-center gap-2"><PieChart className="w-6 h-6" /> 数据导入与边界值说明</h2>
          <p className="text-indigo-400/60 text-sm mt-1">上传 CSV / JSON，自动识别数值列、扫描分母为 0 的空字符串占位，接同一份记录</p>
        </div>
        <div className="flex items-center gap-2">
          {rawData && <ExportButton />}
          {rawData && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-green-400 text-xs font-medium">{rawData.fileName}</span>
            </div>
          )}
        </div>
      </div>

      {!rawData && (
        <div className="space-y-3">
          <FileUploadZone onFileReady={handleFileReady} />
          <div className="flex justify-center">
            <button onClick={handleDemoData} className="px-4 py-2 rounded-lg border border-indigo-500/30 bg-indigo-900/30 text-indigo-300 text-sm hover:bg-indigo-800/40 hover:border-indigo-500/50 transition-colors">
              加载示例数据（含 竞赛得分/竞赛分母、语文/姓名 等场景）
            </button>
          </div>
        </div>
      )}

      {rawData && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-indigo-950/50 border border-indigo-800/30">
            <FileText className="w-5 h-5 text-indigo-400" />
            <div className="flex-1">
              <p className="text-indigo-100 text-sm font-medium">{rawData.fileName}</p>
              <p className="text-indigo-400/50 text-xs">{rawData.rows.length} 行 × {rawData.headers.length} 列 · 导入于 {rawData.uploadTime}</p>
            </div>
            <div className="flex flex-wrap gap-1.5 max-w-[55%] justify-end">
              {rawData.headers.map((h, i) => (
                <span key={h} className={cn('text-[10px] px-2 py-0.5 rounded border',
                  rawData.columnTypes[i] === 'numeric' ? 'bg-mint-600/20 text-mint-500 border-mint-500/30' : 'bg-indigo-800/40 text-indigo-300 border-indigo-700/40')}>
                  {h} · {rawData.columnTypes[i] === 'numeric' ? '数值' : '文本'}
                </span>
              ))}
            </div>
          </div>

          <SummaryStats />
          <BoundaryTable />
          <AnomalyCards />
        </div>
      )}
    </div>
  )
}
