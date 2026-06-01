import { useState, useCallback, useRef } from 'react'
import { useStore } from '@/store/useStore'
import { parseCSV } from '@/utils/csvParser'
import { CSV_TEMPLATE } from '@/data/sampleData'
import {
  Upload,
  FileText,
  Image,
  AlertTriangle,
  Download,
  CheckCircle,
  XCircle,
} from 'lucide-react'

export default function DataManagement() {
  const { points, addPoints, photos, addPhoto, setPoints, currentPlanId, addConflicts } = useStore()
  const [dragOver, setDragOver] = useState(false)
  const [importResult, setImportResult] = useState<{ count: number; anomalies: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = useCallback((text: string, fileName: string) => {
    const newPoints = parseCSV(text)
    const pointsWithPlan = newPoints.map((p) => ({ ...p, planId: currentPlanId || '' }))
    addPoints(pointsWithPlan)

    const anomalyCount = pointsWithPlan.filter((p) => p.status === 'anomaly').length
    setImportResult({ count: pointsWithPlan.length, anomalies: anomalyCount })
  }, [currentPlanId, addPoints])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const text = ev.target?.result as string
        handleFileUpload(text, file.name)
      }
      reader.readAsText(file)
    }
  }, [handleFileUpload])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const text = ev.target?.result as string
        handleFileUpload(text, file.name)
      }
      reader.readAsText(file)
    }
  }, [handleFileUpload])

  const handlePhotoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string
        addPhoto({
          id: `PH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          fileName: file.name,
          dataUrl,
          capturedAt: new Date().toISOString(),
          pointId: '',
          description: '',
        })
      }
      reader.readAsDataURL(file)
    })
  }, [addPhoto])

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = '点位表模板.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  return (
    <div className="w-full h-full overflow-y-auto p-6 space-y-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-lg font-bold text-slate-200">数据管理</h2>
          <p className="text-xs text-slate-500 mt-1">导入点位表、关联巡检照片、检测冲突</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div
            className={`rounded-xl border-2 border-dashed p-6 transition-colors ${
              dragOver
                ? 'border-[#00E5A0]/50 bg-[#00E5A0]/5'
                : 'border-slate-700/50 bg-slate-800/20'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <div className="flex flex-col items-center gap-3">
              <Upload size={28} className={dragOver ? 'text-[#00E5A0]' : 'text-slate-500'} />
              <p className="text-sm text-slate-300">拖拽 CSV 文件到此处</p>
              <p className="text-[10px] text-slate-500">支持 .csv 格式点位表</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-1.5 text-xs bg-[#00E5A0]/15 text-[#00E5A0] rounded border border-[#00E5A0]/30 hover:bg-[#00E5A0]/25 transition-colors"
              >
                选择文件
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 p-6 flex flex-col items-center gap-3">
            <Image size={28} className="text-slate-500" />
            <p className="text-sm text-slate-300">上传巡检照片</p>
            <p className="text-[10px] text-slate-500">JPG/PNG，可多选</p>
            <label className="px-4 py-1.5 text-xs bg-amber-500/15 text-amber-400 rounded border border-amber-500/30 hover:bg-amber-500/25 transition-colors cursor-pointer">
              选择照片
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {importResult && (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 flex items-center gap-3">
            <CheckCircle size={16} className="text-emerald-400" />
            <div className="text-xs text-slate-300">
              成功导入 <span className="text-emerald-400">{importResult.count}</span> 条记录，
              其中 <span className="text-red-400">{importResult.anomalies}</span> 条异常
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 border border-slate-700/50 rounded hover:border-slate-600/50 transition-colors"
          >
            <Download size={12} />
            下载CSV模板
          </button>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
            <FileText size={14} className="text-[#00E5A0]" />
            当前点位数据
            <span className="text-xs text-slate-500">({points.length} 条)</span>
          </h3>
          <div className="rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-800/50 sticky top-0">
                  <tr>
                    {['序号', '构件', '检测项', '测量值', '标准值', '判定', '状态', '来源'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-slate-400 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/30">
                  {points.map((p, i) => (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-3 py-2 text-slate-300">{i + 1}</td>
                      <td className="px-3 py-2 text-slate-300">{p.component}</td>
                      <td className="px-3 py-2 text-slate-300">{p.inspectItem}</td>
                      <td className="px-3 py-2 text-slate-300">{p.measuredValue}</td>
                      <td className="px-3 py-2 text-slate-400">{p.standardValue}</td>
                      <td className="px-3 py-2">
                        <span className={p.judgment.includes('不合格') ? 'text-red-400' : 'text-emerald-400'}>
                          {p.judgment}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          p.status === 'anomaly' ? 'bg-red-500/20 text-red-400' :
                          p.status === 'conflict' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {p.status === 'normal' ? '正常' : p.status === 'anomaly' ? '异常' : p.status === 'conflict' ? '冲突' : '待处理'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-500">{p.sourceRef}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {photos.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Image size={14} className="text-amber-400" />
              已上传照片
              <span className="text-xs text-slate-500">({photos.length} 张)</span>
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {photos.map((photo) => (
                <div key={photo.id} className="rounded-lg overflow-hidden border border-slate-700/50">
                  <img src={photo.dataUrl} alt={photo.fileName} className="w-full h-32 object-cover" />
                  <div className="p-2 bg-slate-800/50 text-[10px] text-slate-400">
                    <p className="text-slate-300 truncate">{photo.fileName}</p>
                    {photo.description && <p>{photo.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
