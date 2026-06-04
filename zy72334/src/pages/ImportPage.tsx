import { useState, useCallback } from 'react'
import { Upload, FileText, CheckCircle, AlertTriangle, ArrowRight } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { parseCSV, parseJSON, toNumericMatrix } from '@/utils/csvParser'
import { cn } from '@/lib/utils'
import type { BoundaryStatus } from '@/types'

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
    reader.onload = () => {
      onFileReady(reader.result as string, file.name, ext)
    }
    reader.readAsText(file)
  }, [onFileReady])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
    if (ext !== 'csv' && ext !== 'json') return
    const reader = new FileReader()
    reader.onload = () => {
      onFileReady(reader.result as string, file.name, ext)
    }
    reader.readAsText(file)
  }, [onFileReady])

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={cn(
        'flex flex-col items-center justify-center gap-4 p-12 rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer',
        dragging
          ? 'border-amber-500 bg-amber-500/5 scale-[1.01]'
          : 'border-indigo-600/40 bg-indigo-950/30 hover:border-indigo-500/60'
      )}
      onClick={() => document.getElementById('file-input')?.click()}
    >
      <Upload className={cn('w-10 h-10', dragging ? 'text-amber-400' : 'text-indigo-400/60')} />
      <div className="text-center">
        <p className="text-indigo-100 text-sm font-medium">拖拽 CSV 或 JSON 文件到此处</p>
        <p className="text-indigo-400/50 text-xs mt-1">或点击选择文件</p>
      </div>
      <input
        id="file-input"
        type="file"
        accept=".csv,.json"
        className="hidden"
        onChange={handleFileInput}
      />
    </div>
  )
}

const statusConfig: Record<BoundaryStatus, { label: string; className: string }> = {
  pending_review: { label: '待复核', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  reviewed: { label: '已复核', className: 'bg-mint-600/30 text-mint-500 border-mint-500/30' },
  resolved: { label: '已解决', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
}

const nextActionStyles: Record<string, string> = {
  '找数据复核人': 'bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25',
  '找竞赛教练唐老师': 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 hover:bg-indigo-500/25',
}

function BoundaryTable() {
  const boundaryRecords = useStore(s => s.boundaryRecords)
  const updateBoundaryStatus = useStore(s => s.updateBoundaryStatus)

  if (boundaryRecords.length === 0) return null

  const handleConfirmReview = (id: string, currentStatus: BoundaryStatus, issueType: string) => {
    updateBoundaryStatus(id, 'reviewed')
  }

  const handleMarkResolved = (id: string, record: { issueType: string; status: BoundaryStatus }) => {
    if (record.issueType === 'denominator_zero_empty' && record.status !== 'reviewed') return
    updateBoundaryStatus(id, 'resolved')
  }

  return (
    <div className="mt-6">
      <h3 className="font-serif text-lg text-amber-400 mb-3 flex items-center gap-2">
        <FileText className="w-5 h-5" />
        边界值扫描结果
      </h3>
      <div className="overflow-x-auto rounded-lg border border-indigo-800/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-indigo-950/80 text-indigo-300/70 text-xs uppercase tracking-wider">
              <th className="px-4 py-3 text-left font-medium">行号</th>
              <th className="px-4 py-3 text-left font-medium">列名</th>
              <th className="px-4 py-3 text-left font-medium">当前值</th>
              <th className="px-4 py-3 text-left font-medium">分母列</th>
              <th className="px-4 py-3 text-left font-medium">分母值</th>
              <th className="px-4 py-3 text-left font-medium">状态</th>
              <th className="px-4 py-3 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-indigo-800/20">
            {boundaryRecords.map(record => {
              const cfg = statusConfig[record.status]
              return (
                <tr
                  key={record.id}
                  className={cn(
                    'hover:bg-indigo-900/20 transition-colors',
                    record.issueType === 'denominator_zero_empty' && 'border-l-2 border-l-amber-500'
                  )}
                >
                  <td className="px-4 py-3 text-indigo-100 font-mono text-xs">{record.rowIndex + 1}</td>
                  <td className="px-4 py-3 text-indigo-100">{record.columnName}</td>
                  <td className="px-4 py-3 text-indigo-200 font-mono text-xs">
                    {record.currentValue === '' ? '∅' : record.currentValue}
                  </td>
                  <td className="px-4 py-3 text-indigo-300/80">{record.denominatorColumnName}</td>
                  <td className="px-4 py-3 text-indigo-200 font-mono text-xs">{record.denominatorValue}</td>
                  <td className="px-4 py-3">
                    <span className={cn('inline-flex px-2 py-0.5 rounded-full text-xs border', cfg.className)}>
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {record.status === 'pending_review' && (
                        <button
                          onClick={() => handleConfirmReview(record.id, record.status, record.issueType)}
                          className="px-2.5 py-1 text-xs rounded border border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                        >
                          确认复核
                        </button>
                      )}
                      {record.status === 'reviewed' && (
                        <button
                          onClick={() => handleMarkResolved(record.id, record)}
                          className="px-2.5 py-1 text-xs rounded border border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                        >
                          标已解决
                        </button>
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
  )
}

function AnomalyCards() {
  const boundaryRecords = useStore(s => s.boundaryRecords)

  const anomalyRecords = boundaryRecords.filter(r => r.issueType === 'denominator_zero_empty')

  if (anomalyRecords.length === 0) return null

  return (
    <div className="mt-6">
      <h3 className="font-serif text-lg text-amber-400 mb-3 flex items-center gap-2">
        <AlertTriangle className="w-5 h-5" />
        异常分析卡片
      </h3>
      <div className="grid gap-4">
        {anomalyRecords.map(record => (
          <div
            key={record.id}
            className={cn(
              'rounded-lg border border-amber-500/20 bg-indigo-950/60 p-4',
              'border-l-[3px] border-l-amber-500',
              'animate-glow'
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-3">
                <h4 className="font-serif text-amber-400 text-sm font-semibold">
                  第 {record.rowIndex + 1} 行 · {record.columnName}
                </h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-indigo-400/60 text-xs font-medium">为什么被留下</span>
                    <p className="text-indigo-200 text-sm mt-0.5 leading-relaxed">{record.reason}</p>
                  </div>
                  <div>
                    <span className="text-indigo-400/60 text-xs font-medium">还缺什么材料</span>
                    <p className="text-indigo-200 text-sm mt-0.5 leading-relaxed">{record.missingMaterial}</p>
                  </div>
                </div>
              </div>
              <button
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors shrink-0',
                  nextActionStyles[record.nextAction] ?? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                )}
              >
                <ArrowRight className="w-3.5 h-3.5" />
                {record.nextAction}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ImportPage() {
  const rawData = useStore(s => s.rawData)
  const importData = useStore(s => s.importData)

  const handleFileReady = useCallback((text: string, name: string, ext: string) => {
    let parsed: { headers: string[]; rows: string[][] }
    if (ext === 'json') {
      parsed = parseJSON(text)
    } else {
      parsed = parseCSV(text)
    }
    if (parsed.headers.length === 0) return
    const numericMatrix = toNumericMatrix(parsed.rows, parsed.headers.length)
    importData({
      id: `raw-${Date.now()}`,
      fileName: name,
      headers: parsed.headers,
      rows: parsed.rows,
      numericMatrix,
      uploadTime: new Date().toLocaleString('zh-CN'),
    })
  }, [importData])

  const handleDemoData = useCallback(() => {
    handleFileReady(DEMO_CSV, '示例数据.csv', 'csv')
  }, [handleFileReady])

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-serif text-2xl text-amber-400 font-bold">数据导入</h2>
          <p className="text-indigo-400/60 text-sm mt-1">上传 CSV 或 JSON 文件，开始奇异值降维分析</p>
        </div>
        {rawData && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-green-400 text-xs font-medium">{rawData.fileName}</span>
          </div>
        )}
      </div>

      {!rawData && (
        <div className="space-y-3">
          <FileUploadZone onFileReady={handleFileReady} />
          <div className="flex justify-center">
            <button
              onClick={handleDemoData}
              className="px-4 py-2 rounded-lg border border-indigo-500/30 bg-indigo-900/30 text-indigo-300 text-sm hover:bg-indigo-800/40 hover:border-indigo-500/50 transition-colors"
            >
              加载示例数据
            </button>
          </div>
        </div>
      )}

      {rawData && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-indigo-950/50 border border-indigo-800/30">
            <FileText className="w-5 h-5 text-indigo-400" />
            <div>
              <p className="text-indigo-100 text-sm font-medium">{rawData.fileName}</p>
              <p className="text-indigo-400/50 text-xs">
                {rawData.rows.length} 行 × {rawData.headers.length} 列 · 导入于 {rawData.uploadTime}
              </p>
            </div>
          </div>
          <BoundaryTable />
          <AnomalyCards />
        </div>
      )}
    </div>
  )
}
