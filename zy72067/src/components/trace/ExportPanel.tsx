import { useState } from 'react'
import { Download, FileJson, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import type { ExportOptions } from '@/types'

interface ReportData {
  export_time: string
  scheme: Record<string, unknown>
  summary: Record<string, unknown>
  records: Array<Record<string, unknown>>
  parameter_changes: Array<Record<string, unknown>>
  conflicts: Array<Record<string, unknown>>
  coordinate_system_annotations: Array<Record<string, unknown>>
}

function CheckboxItem({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <div className={cn(
        'w-4 h-4 rounded border flex items-center justify-center transition-colors',
        checked ? 'bg-amber-500 border-amber-500' : 'border-gray-600 group-hover:border-gray-400',
      )} onClick={() => onChange(!checked)}>
        {checked && <Check className="w-3 h-3 text-black" />}
      </div>
      <span className="text-sm text-gray-300">{label}</span>
    </label>
  )
}

function SchemeSection({ scheme }: { scheme: Record<string, unknown> }) {
  return (
    <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/30">
      <h4 className="text-sm font-medium text-amber-400 mb-2">方案信息</h4>
      <div className="grid grid-cols-2 gap-2 text-xs">
        {Object.entries(scheme).map(([key, value]) => (
          <div key={key}>
            <span className="text-gray-500">{key}: </span>
            <span className="text-gray-300">{String(value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function RecordsSection({ records }: { records: Array<Record<string, unknown>> }) {
  if (records.length === 0) return null
  return (
    <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/30">
      <h4 className="text-sm font-medium text-blue-400 mb-2">热斑记录 ({records.length})</h4>
      <div className="space-y-2">
        {records.map((rec, i) => (
          <div key={i} className="p-2 rounded bg-[#1a1a2e] border border-gray-700/20 text-xs">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gray-200 font-medium">{String(rec.name || '')}</span>
              <span className={cn(
                'px-1.5 py-0.5 rounded text-xs',
                rec.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                rec.severity === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                'bg-green-500/20 text-green-400',
              )}>
                {String(rec.severity || '')}
              </span>
            </div>
            <div className="flex gap-3 text-gray-400">
              <span>温度: {String(rec.temperature || '')}</span>
              <span>坐标系: {String(rec.coordinate_system || '')}</span>
            </div>
            {Array.isArray(rec.sources) && rec.sources.length > 0 && (
              <div className="mt-1 text-gray-500">
                来源链: {rec.sources.map((s: Record<string, unknown>) => String(s.source_name || '')).join(' → ')}
              </div>
            )}
            <div className="mt-1 text-gray-600">
              芯片封装热斑立方 · 处理时间: {String(rec.updated_at || rec.created_at || '')}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChangesSection({ changes }: { changes: Array<Record<string, unknown>> }) {
  if (changes.length === 0) return null
  return (
    <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/30">
      <h4 className="text-sm font-medium text-green-400 mb-2">参数变更历史 ({changes.length})</h4>
      <div className="space-y-1">
        {changes.map((c, i) => (
          <div key={i} className="text-xs p-1.5 rounded bg-[#1a1a2e]">
            <span className="text-gray-300">{String(c.parameter_name || '')}</span>
            <span className="text-gray-500">: </span>
            <span className="text-red-400">{String(c.old_value || '')}</span>
            <span className="text-gray-500"> → </span>
            <span className="text-green-400">{String(c.new_value || '')}</span>
            <span className="text-gray-600 ml-2">{String(c.changed_at || '')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ConflictsSection({ conflicts }: { conflicts: Array<Record<string, unknown>> }) {
  if (conflicts.length === 0) return null
  return (
    <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/30">
      <h4 className="text-sm font-medium text-red-400 mb-2">冲突处理记录 ({conflicts.length})</h4>
      <div className="space-y-1">
        {conflicts.map((c, i) => (
          <div key={i} className="text-xs p-1.5 rounded bg-[#1a1a2e]">
            <span className={cn(
              'px-1.5 py-0.5 rounded mr-2',
              c.resolved_at ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400',
            )}>
              {c.resolved_at ? '已解决' : '未解决'}
            </span>
            <span className="text-gray-300">{String(c.conflict_type || '')}</span>
            {c.resolution && <span className="text-gray-500 ml-2">→ {String(c.resolution)}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

function AnnotationsSection({ annotations }: { annotations: Array<Record<string, unknown>> }) {
  if (annotations.length === 0) return null
  return (
    <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/30">
      <h4 className="text-sm font-medium text-blue-400 mb-2">坐标系标注说明</h4>
      <div className="space-y-1">
        {annotations.map((a, i) => (
          <div key={i} className="text-xs p-2 rounded bg-blue-500/10 border border-blue-500/20 text-blue-300">
            坐标系 {String(a.system || '')}：共 {String(a.record_count || 0)} 条记录
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ExportPanel() {
  const [options, setOptions] = useState<ExportOptions>({
    format: 'json',
    includeChangelog: true,
    includeConflicts: true,
    includeSourceChain: true,
  })
  const [preview, setPreview] = useState<ReportData | null>(null)
  const [generating, setGenerating] = useState(false)
  const loading = useStore(s => s.loading)

  const generatePreview = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/schemes/demo-001/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options),
      })
      if (!res.ok) throw new Error(`导出失败: ${res.status}`)
      const json = await res.json()
      setPreview(json.data || json)
    } catch (err) {
      console.error(err)
    } finally {
      setGenerating(false)
    }
  }

  const downloadJson = () => {
    if (!preview) return
    const blob = new Blob([JSON.stringify(preview, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `trace-report-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4 overflow-y-auto max-h-[calc(100vh-180px)] space-y-4">
      <div className="p-4 rounded-lg bg-gray-800/50 border border-gray-700/30 space-y-3">
        <h3 className="text-sm font-medium text-gray-200">导出选项</h3>
        <div className="space-y-2">
          <CheckboxItem
            checked={options.includeChangelog}
            onChange={v => setOptions(prev => ({ ...prev, includeChangelog: v }))}
            label="包含参数变更历史"
          />
          <CheckboxItem
            checked={options.includeConflicts}
            onChange={v => setOptions(prev => ({ ...prev, includeConflicts: v }))}
            label="包含冲突处理记录"
          />
          <CheckboxItem
            checked={options.includeSourceChain}
            onChange={v => setOptions(prev => ({ ...prev, includeSourceChain: v }))}
            label="包含来源追溯链"
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <FileJson className="w-4 h-4" />
          <span>导出格式: JSON</span>
        </div>
        <button
          onClick={generatePreview}
          disabled={generating || loading}
          className={cn(
            'px-4 py-2 rounded text-sm font-medium transition-colors',
            generating || loading
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-amber-500 text-black hover:bg-amber-400',
          )}
        >
          {generating ? '生成中...' : '生成报告预览'}
        </button>
      </div>

      {preview && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-200">报告预览</h3>
            <button
              onClick={downloadJson}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-blue-500 text-white hover:bg-blue-400 transition-colors"
            >
              <Download className="w-4 h-4" />
              下载JSON文件
            </button>
          </div>

          <SchemeSection scheme={preview.scheme} />
          <RecordsSection records={preview.records} />
          {options.includeChangelog && <ChangesSection changes={preview.parameter_changes} />}
          {options.includeConflicts && <ConflictsSection conflicts={preview.conflicts} />}
          <AnnotationsSection annotations={preview.coordinate_system_annotations} />
        </div>
      )}
    </div>
  )
}
