import { useEffect, useState, useRef, useCallback } from 'react'
import { Upload, RefreshCw, FileText, Plus, X } from 'lucide-react'
import { useProjectStore } from '@/store'
import { useEnsureProject } from '@/hooks/useEnsureProject'
import { fetchProjects, fetchPrecheck, seedData, importData } from '@/api'
import { parseJsonField } from '@/lib/utils'

const typeTranslations: Record<string, string> = {
  same_name: '同名路口',
  duplicate_complaint: '重复投诉',
  coordinate_drift: '坐标偏移',
  cross_period: '跨时段统计',
  field_missing: '字段缺失',
}

const severityConfig: Record<string, { label: string; cls: string }> = {
  error: { label: '严重', cls: 'bg-rose-100 text-rose-600' },
  warning: { label: '警告', cls: 'bg-amber-100 text-amber-600' },
  info: { label: '信息', cls: 'bg-blue-100 text-blue-600' },
}

const FIELD_MAP: Record<string, string> = {
  '点位名称': 'location_name',
  '地址': 'address',
  '经度': 'longitude',
  '纬度': 'latitude',
  '时段': 'period',
  '日照时长': 'sunlight_hours',
  '投诉情况': 'complaint',
  '备注': 'remark',
}

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        result.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
  }
  result.push(current.trim())
  return result
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0])
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = values[i] || ''
    })
    return row
  })
}

interface ManualRow {
  location_name: string
  address: string
  longitude: string
  latitude: string
  period: string
  sunlight_hours: string
  complaint: string
  remark: string
}

function emptyRow(): ManualRow {
  return { location_name: '', address: '', longitude: '', latitude: '', period: '', sunlight_hours: '', complaint: '', remark: '' }
}

export default function ImportPage() {
  const { currentProjectId, setCurrentProjectId } = useProjectStore()
  const { ready, noProject } = useEnsureProject()
  const [projects, setProjects] = useState<any[]>([])
  const [warnings, setWarnings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [mode, setMode] = useState<'idle' | 'file' | 'manual'>('idle')
  const [fileSource, setFileSource] = useState<'sunlight' | 'ledger'>('sunlight')
  const [manualRows, setManualRows] = useState<ManualRow[]>([emptyRow()])
  const [manualSource, setManualSource] = useState<'sunlight' | 'ledger'>('sunlight')
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadPrecheck = useCallback(async () => {
    if (!currentProjectId) return
    try {
      const w = await fetchPrecheck(currentProjectId)
      setWarnings(w)
    } catch (e: any) {
      setError(e?.message || '预检加载失败')
    }
  }, [currentProjectId])

  useEffect(() => {
    async function init() {
      try {
        const list = await fetchProjects()
        setProjects(list)
        if (!currentProjectId && list.length > 0) {
          setCurrentProjectId(list[0].id)
        }
      } catch (e: any) {
        setError(e?.message || '项目列表加载失败')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [currentProjectId, setCurrentProjectId])

  useEffect(() => {
    if (currentProjectId) loadPrecheck()
  }, [currentProjectId, loadPrecheck])

  async function handleSeed() {
    if (!currentProjectId) return
    setSeeding(true)
    setImportMsg(null)
    try {
      await seedData(currentProjectId)
      await loadPrecheck()
      setImportMsg('示范数据加载成功')
    } catch (e: any) {
      setImportMsg('加载失败：' + e.message)
    } finally {
      setSeeding(false)
    }
  }

  async function handleFileImport(file: File) {
    if (!currentProjectId) return
    setImporting(true)
    setImportMsg(null)
    try {
      const text = await file.text()
      const rows = parseCsv(text)
      if (rows.length === 0) {
        setImportMsg('文件为空或格式不正确，需含表头行和至少一行数据')
        return
      }
      await importData(currentProjectId, fileSource, rows)
      await loadPrecheck()
      setImportMsg(`成功导入 ${rows.length} 条记录`)
      setMode('idle')
    } catch (e: any) {
      setImportMsg('导入失败：' + e.message)
    } finally {
      setImporting(false)
    }
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.txt'))) {
      handleFileImport(file)
    } else {
      setImportMsg('仅支持 CSV 文件')
    }
  }, [currentProjectId, fileSource])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileImport(file)
    e.target.value = ''
  }, [currentProjectId, fileSource])

  async function handleManualImport() {
    if (!currentProjectId) return
    const filled = manualRows.filter((r) => r.location_name.trim())
    if (filled.length === 0) {
      setImportMsg('至少填写一条记录的点位名称')
      return
    }
    setImporting(true)
    setImportMsg(null)
    try {
      await importData(currentProjectId, manualSource, filled)
      await loadPrecheck()
      setImportMsg(`成功导入 ${filled.length} 条记录`)
      setManualRows([emptyRow()])
      setMode('idle')
    } catch (e: any) {
      setImportMsg('导入失败：' + e.message)
    } finally {
      setImporting(false)
    }
  }

  function updateManualRow(idx: number, field: keyof ManualRow, value: string) {
    setManualRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  function addManualRow() {
    setManualRows((prev) => [...prev, emptyRow()])
  }

  function removeManualRow(idx: number) {
    setManualRows((prev) => prev.filter((_, i) => i !== idx))
  }

  if (!ready || loading) {
    return <div className="flex items-center justify-center h-full text-slate-400">加载中...</div>
  }

  if (noProject) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <Upload className="w-10 h-10 text-slate-300" />
        <p className="text-slate-400">暂无项目，请先到工作台创建项目</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-rose-500 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl">
      <h2
        className="text-2xl font-bold text-slate-800 mb-6"
        style={{ fontFamily: 'var(--font-heading)' }}
      >
        数据导入
      </h2>

      {projects.length > 1 && (
        <div className="mb-4">
          <select
            value={currentProjectId || ''}
            onChange={(e) => setCurrentProjectId(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-700/30"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {importMsg && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${importMsg.includes('失败') || importMsg.includes('不正确') || importMsg.includes('至少') ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          {importMsg}
        </div>
      )}

      {mode === 'idle' && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <button
            onClick={() => setMode('file')}
            className="flex flex-col items-center gap-3 p-6 bg-white rounded-lg border-2 border-dashed border-slate-300 hover:border-teal-700 hover:bg-teal-50/30 transition-colors"
          >
            <Upload className="w-8 h-8 text-teal-700" />
            <span className="text-sm font-medium text-slate-700">上传 CSV 文件</span>
            <span className="text-xs text-slate-400">支持中英文表头</span>
          </button>
          <button
            onClick={() => setMode('manual')}
            className="flex flex-col items-center gap-3 p-6 bg-white rounded-lg border-2 border-dashed border-slate-300 hover:border-amber-600 hover:bg-amber-50/30 transition-colors"
          >
            <FileText className="w-8 h-8 text-amber-600" />
            <span className="text-sm font-medium text-slate-700">手动录入</span>
            <span className="text-xs text-slate-400">逐条填写数据</span>
          </button>
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="flex flex-col items-center gap-3 p-6 bg-white rounded-lg border-2 border-dashed border-slate-300 hover:border-emerald-600 hover:bg-emerald-50/30 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-8 h-8 text-emerald-600 ${seeding ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium text-slate-700">{seeding ? '加载中...' : '加载示范数据'}</span>
            <span className="text-xs text-slate-400">含同名路口、重复投诉等场景</span>
          </button>
        </div>
      )}

      {mode === 'file' && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-slate-700">上传 CSV 文件</h3>
              <select
                value={fileSource}
                onChange={(e) => setFileSource(e.target.value as 'sunlight' | 'ledger')}
                className="px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/30"
              >
                <option value="sunlight">实测数据</option>
                <option value="ledger">审批台账</option>
              </select>
            </div>
            <button onClick={() => setMode('idle')} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> 返回
            </button>
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={`flex flex-col items-center gap-3 p-10 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
              dragOver ? 'border-teal-700 bg-teal-50/50' : 'border-slate-300 hover:border-teal-700'
            } ${importing ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <Upload className="w-10 h-10 text-teal-700" />
            <p className="text-sm text-slate-600">
              {importing ? '正在导入...' : '拖拽 CSV 文件到此处，或点击选择文件'}
            </p>
            <p className="text-xs text-slate-400">
              表头支持：点位名称/地址/经度/纬度/时段/日照时长/投诉情况/备注
            </p>
          </div>
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={onFileChange} className="hidden" />
        </div>
      )}

      {mode === 'manual' && (
        <div className="bg-white rounded-lg border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-semibold text-slate-700">手动录入</h3>
              <select
                value={manualSource}
                onChange={(e) => setManualSource(e.target.value as 'sunlight' | 'ledger')}
                className="px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-teal-700/30"
              >
                <option value="sunlight">实测数据</option>
                <option value="ledger">审批台账</option>
              </select>
            </div>
            <button onClick={() => setMode('idle')} className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> 返回
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm mb-3">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-2 py-2 text-slate-500 font-medium text-xs">点位名称 *</th>
                  <th className="text-left px-2 py-2 text-slate-500 font-medium text-xs">地址</th>
                  <th className="text-left px-2 py-2 text-slate-500 font-medium text-xs">经度</th>
                  <th className="text-left px-2 py-2 text-slate-500 font-medium text-xs">纬度</th>
                  <th className="text-left px-2 py-2 text-slate-500 font-medium text-xs">时段</th>
                  <th className="text-left px-2 py-2 text-slate-500 font-medium text-xs">日照时长</th>
                  <th className="text-left px-2 py-2 text-slate-500 font-medium text-xs">投诉情况</th>
                  <th className="text-left px-2 py-2 text-slate-500 font-medium text-xs">备注</th>
                  <th className="px-2 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {manualRows.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="px-2 py-1.5"><input value={row.location_name} onChange={(e) => updateManualRow(idx, 'location_name', e.target.value)} className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-700/30" placeholder="必填" /></td>
                    <td className="px-2 py-1.5"><input value={row.address} onChange={(e) => updateManualRow(idx, 'address', e.target.value)} className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-700/30" /></td>
                    <td className="px-2 py-1.5"><input value={row.longitude} onChange={(e) => updateManualRow(idx, 'longitude', e.target.value)} className="w-20 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-700/30" /></td>
                    <td className="px-2 py-1.5"><input value={row.latitude} onChange={(e) => updateManualRow(idx, 'latitude', e.target.value)} className="w-20 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-700/30" /></td>
                    <td className="px-2 py-1.5"><input value={row.period} onChange={(e) => updateManualRow(idx, 'period', e.target.value)} className="w-28 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-700/30" placeholder="2024年下半年" /></td>
                    <td className="px-2 py-1.5"><input value={row.sunlight_hours} onChange={(e) => updateManualRow(idx, 'sunlight_hours', e.target.value)} className="w-16 px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-700/30" /></td>
                    <td className="px-2 py-1.5"><input value={row.complaint} onChange={(e) => updateManualRow(idx, 'complaint', e.target.value)} className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-700/30" /></td>
                    <td className="px-2 py-1.5"><input value={row.remark} onChange={(e) => updateManualRow(idx, 'remark', e.target.value)} className="w-full px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-teal-700/30" /></td>
                    <td className="px-2 py-1.5">
                      {manualRows.length > 1 && (
                        <button onClick={() => removeManualRow(idx)} className="text-slate-400 hover:text-rose-500">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={addManualRow} className="flex items-center gap-1 px-3 py-1.5 text-xs text-teal-700 hover:bg-teal-50 rounded-lg border border-teal-200">
              <Plus className="w-3.5 h-3.5" /> 添加一行
            </button>
            <div className="flex-1" />
            <button
              onClick={handleManualImport}
              disabled={importing}
              className="flex items-center gap-2 px-5 py-2 bg-teal-700 text-white rounded-lg text-sm font-medium hover:bg-teal-800 disabled:opacity-50"
            >
              {importing ? '导入中...' : '确认导入'}
            </button>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-500 mb-3">
            预检结果（{warnings.length} 条）
          </h3>
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">严重程度</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">异常类型</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">描述</th>
                  <th className="text-left px-4 py-3 text-slate-500 font-medium">原始值</th>
                </tr>
              </thead>
              <tbody>
                {warnings.map((w) => {
                  const sev = severityConfig[w.severity] || severityConfig.info
                  const originalValues = parseJsonField<Record<string, string>>(
                    w.original_values,
                    {}
                  )
                  return (
                    <tr key={w.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sev.cls}`}>
                          {sev.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {typeTranslations[w.type] || w.type}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{w.description}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs font-mono">
                        {Object.entries(originalValues)
                          .map(([k, v]) => v)
                          .join('；')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && warnings.length === 0 && currentProjectId && (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-slate-400">
          暂无预检结果，请先导入数据
        </div>
      )}
    </div>
  )
}
