import { useEffect, useState } from 'react'
import { useCoralStore } from '@/store/coralStore'
import { Download, FileJson, FileSpreadsheet, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'

const anomalyTypeLabels: Record<string, string> = {
  coordinate_swap: '坐标互换',
  time_mismatch: '时空错配',
  bleaching_anomaly: '白化异常',
  data_gap: '数据间隔',
}

const severityLabels: Record<string, string> = {
  critical: '严重',
  warning: '警告',
  info: '提示',
}

const statusLabels: Record<string, string> = {
  open: '待处理',
  acknowledged: '已确认',
  resolved: '已解决',
}

export default function ExportPage() {
  const { runs, anomalies, loading, fetchRuns, fetchAnomalies, exportReport } = useCoralStore()
  const [runId, setRunId] = useState('')
  const [includeAnnotations, setIncludeAnnotations] = useState(true)
  const [includeCoordCorrections, setIncludeCoordCorrections] = useState(true)
  const [format, setFormat] = useState<'json' | 'csv'>('json')
  const [preview, setPreview] = useState<any>(null)

  useEffect(() => {
    fetchRuns()
    fetchAnomalies()
  }, [])

  useEffect(() => {
    if (runs.length > 0 && !runId) {
      setRunId(runs[0].id)
    }
  }, [runs])

  const handleExport = async () => {
    if (!runId) return
    const result = await exportReport({
      run_id: runId,
      include_annotations: includeAnnotations,
      include_coordinate_corrections: includeCoordCorrections,
      format,
    })
    if (result) {
      setPreview(result)
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `coral_bleaching_report_${new Date().toISOString().slice(0, 10)}.${format === 'csv' ? 'csv' : 'json'}`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const selectedRun = runs.find((r: any) => r.id === runId)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-3 gap-6">
        <div className="glass-card p-5 space-y-4">
          <h3 className="font-serif text-ocean-500 text-base">导出配置</h3>

          <div>
            <label className="block text-xs text-ocean-400 mb-1">选择跑批</label>
            <select
              value={runId}
              onChange={(e) => setRunId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-ocean-100 text-sm text-ocean-500 focus:outline-none focus:border-seafoam-500"
            >
              {runs.map((run: any) => (
                <option key={run.id} value={run.id}>
                  {new Date(run.run_time).toLocaleString('zh-CN')} — {run.status === 'completed' ? '已完成' : run.status}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-ocean-500">
              <input
                type="checkbox"
                checked={includeAnnotations}
                onChange={(e) => setIncludeAnnotations(e.target.checked)}
                className="rounded border-ocean-200 text-seafoam-500 focus:ring-seafoam-500"
              />
              包含备注信息
            </label>
            <label className="flex items-center gap-2 text-sm text-ocean-500">
              <input
                type="checkbox"
                checked={includeCoordCorrections}
                onChange={(e) => setIncludeCoordCorrections(e.target.checked)}
                className="rounded border-ocean-200 text-seafoam-500 focus:ring-seafoam-500"
              />
              包含坐标修正
            </label>
          </div>

          <div>
            <label className="block text-xs text-ocean-400 mb-2">导出格式</label>
            <div className="flex gap-3">
              <label className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors',
                format === 'json' ? 'border-seafoam-500 bg-seafoam-50 text-seafoam-700' : 'border-ocean-100 text-ocean-400 hover:border-ocean-200'
              )}>
                <input type="radio" name="format" value="json" checked={format === 'json'} onChange={() => setFormat('json')} className="hidden" />
                <FileJson className="w-4 h-4" />
                JSON
              </label>
              <label className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors',
                format === 'csv' ? 'border-seafoam-500 bg-seafoam-50 text-seafoam-700' : 'border-ocean-100 text-ocean-400 hover:border-ocean-200'
              )}>
                <input type="radio" name="format" value="csv" checked={format === 'csv'} onChange={() => setFormat('csv')} className="hidden" />
                <FileSpreadsheet className="w-4 h-4" />
                CSV
              </label>
            </div>
          </div>

          <button
            onClick={handleExport}
            disabled={loading || !runId}
            className="w-full flex items-center justify-center gap-2 bg-coral-500 hover:bg-coral-600 text-white py-3 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            导出异常队列
          </button>
        </div>

        <div className="col-span-2 space-y-4">
          <h3 className="font-serif text-white text-base flex items-center gap-2">
            <Eye className="w-4 h-4 text-seafoam-400" />
            导出预览
          </h3>

          {selectedRun ? (
            <div className="space-y-4">
              <div className="glass-card p-4">
                <h4 className="text-sm font-semibold text-ocean-500 mb-3">汇总指标</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-ocean-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-ocean-500 font-mono">{selectedRun.total_records}</p>
                    <p className="text-xs text-ocean-400">总记录</p>
                  </div>
                  <div className="bg-coral-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-coral-600 font-mono">{selectedRun.anomaly_count}</p>
                    <p className="text-xs text-coral-400">异常数</p>
                  </div>
                  <div className="bg-seafoam-50 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-seafoam-600 font-mono">{runId ? anomalies.length : 0}</p>
                    <p className="text-xs text-seafoam-400">当前异常</p>
                  </div>
                </div>
              </div>

              <div className="glass-card p-4">
                <h4 className="text-sm font-semibold text-ocean-500 mb-3">异常队列预览（前5条）</h4>
                <div className="space-y-2">
                  {anomalies.slice(0, 5).map((a: any) => (
                    <div key={a.id} className="flex items-center gap-2 text-xs bg-ocean-50/50 rounded-lg px-3 py-2">
                      <span className={cn(
                        'px-1.5 py-0.5 rounded font-semibold',
                        a.severity === 'critical' ? 'bg-red-100 text-red-700' :
                        a.severity === 'warning' ? 'bg-coral-100 text-coral-700' : 'bg-ocean-100 text-ocean-700'
                      )}>
                        {severityLabels[a.severity]}
                      </span>
                      <span className="text-ocean-500 font-mono">{anomalyTypeLabels[a.anomaly_type]}</span>
                      <span className="text-ocean-400 flex-1 truncate">{a.description}</span>
                      <span className="text-ocean-300">{statusLabels[a.status]}</span>
                    </div>
                  ))}
                  {anomalies.length > 5 && (
                    <p className="text-xs text-ocean-300 text-center">...还有 {anomalies.length - 5} 条</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card p-4">
                  <h4 className="text-sm font-semibold text-ocean-500 mb-2">备注信息</h4>
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${includeAnnotations ? 'bg-seafoam-500' : 'bg-gray-300'}`} />
                    <span className="text-sm text-ocean-500">
                      {includeAnnotations ? '已包含' : '不包含'}
                    </span>
                  </div>
                </div>
                <div className="glass-card p-4">
                  <h4 className="text-sm font-semibold text-ocean-500 mb-2">坐标修正</h4>
                  <div className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${includeCoordCorrections ? 'bg-seafoam-500' : 'bg-gray-300'}`} />
                    <span className="text-sm text-ocean-500">
                      {includeCoordCorrections ? '已包含' : '不包含'}
                    </span>
                  </div>
                  {includeCoordCorrections && (
                    <p className="text-xs text-ocean-400 mt-1">
                      导出后自动标记为已持久化到文件
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="glass-card p-8 text-center">
              <p className="text-ocean-400 text-sm">请选择跑批后查看预览</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
