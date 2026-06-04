import { useEffect, useState, useRef, useCallback } from 'react'
import { Upload, FileUp, ChevronDown, ChevronRight, AlertTriangle, Clock } from 'lucide-react'
import { useAppStore } from '@/store'
import type { ParamItem } from '@/store'

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n')
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim())
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = values[i] || ''
    })
    return obj
  })
}

export default function Params() {
  const { paramVersions, paramItems, fetchParamVersions, fetchParamItems, importParams, loading } = useAppStore()
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<{ duplicateCount: number; importedCount: number; duplicates: Record<string, unknown>[] } | null>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [expandedRationale, setExpandedRationale] = useState<Set<string>>(new Set())
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchParamVersions()
    fetchParamItems()
  }, [fetchParamVersions, fetchParamItems])

  const handleVersionClick = useCallback((versionId: string) => {
    setSelectedVersionId(versionId)
    fetchParamItems(versionId)
  }, [fetchParamItems])

  const handleFile = useCallback(async (file: File) => {
    setImportError(null)
    setImportResult(null)
    try {
      const text = await file.text()
      let data: Record<string, unknown>[]
      if (file.name.endsWith('.json')) {
        data = JSON.parse(text)
      } else if (file.name.endsWith('.csv')) {
        data = parseCsv(text)
      } else {
        setImportError('仅支持 JSON 或 CSV 文件')
        return
      }
      if (!Array.isArray(data)) {
        setImportError('文件内容必须为数组')
        return
      }
      const result = await importParams(data)
      setImportResult(result)
      setSelectedVersionId(result.versionId)
    } catch (e: unknown) {
      setImportError(e instanceof Error ? e.message : String(e))
    }
  }, [importParams])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const toggleRationale = (id: string) => {
    setExpandedRationale((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">参数调试表</h2>

      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragOver ? 'border-amber-400 bg-amber-400/5' : 'border-slate-600 bg-slate-800/30'
        }`}
      >
        <FileUp size={32} className="mx-auto mb-2 text-slate-400" />
        <p className="text-sm text-slate-400 mb-3">拖放 JSON/CSV 文件到此处</p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded text-sm transition-colors"
          >
            <Upload size={14} className="inline mr-1" />
            导入
          </button>
          <input ref={fileInputRef} type="file" accept=".json,.csv" onChange={onFileChange} className="hidden" />
        </div>
      </div>

      {importResult && (
        <div className="bg-slate-800 rounded-lg p-4">
          <div className="flex gap-6 text-sm mb-2">
            <span className="text-emerald-400">导入成功: {importResult.importedCount} 条</span>
            {importResult.duplicateCount > 0 && (
              <span className="text-amber-400">重复跳过: {importResult.duplicateCount} 条</span>
            )}
          </div>
          {importResult.duplicates.length > 0 && (
            <div className="text-xs text-slate-400 mt-2">
              <p className="mb-1">重复项:</p>
              {importResult.duplicates.map((d: Record<string, unknown>, i: number) => (
                <div key={i} className="font-mono bg-slate-900 rounded px-2 py-1 mb-1">{JSON.stringify(d)}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {importError && (
        <div className="bg-red-900/30 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">{importError}</div>
      )}

      <div className="flex gap-6">
        <div className="w-56 flex-shrink-0">
          <h3 className="text-sm font-medium text-slate-300 mb-3">版本时间线</h3>
          <div className="space-y-2">
            {paramVersions.map((v) => (
              <button
                key={v.id}
                onClick={() => handleVersionClick(v.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedVersionId === v.id ? 'bg-amber-400/10 border border-amber-400/30' : 'bg-slate-800 border border-slate-700 hover:bg-slate-700'
                }`}
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Clock size={14} className="text-slate-400" />
                  v{v.version}
                </div>
                <div className="text-xs text-slate-400 mt-1">{new Date(v.importedAt).toLocaleString('zh-CN')}</div>
                <div className="text-xs text-slate-500 mt-0.5">{v.itemCount} 条 · {v.importedBy}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="text-center text-slate-400 py-10">加载中...</div>
          ) : paramItems.length === 0 ? (
            <div className="text-center text-slate-500 py-10">暂无参数数据</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">名称</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">值</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">依据</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">版本</th>
                  <th className="text-left py-2 px-3 text-slate-400 font-medium">复核状态</th>
                </tr>
              </thead>
              <tbody>
                {paramItems.map((item: ParamItem, idx: number) => (
                  <tr
                    key={item.id}
                    className={`border-b border-slate-700/50 ${
                      item.isDenominatorZero ? 'bg-amber-500/10' : idx % 2 === 1 ? 'bg-slate-800/30' : ''
                    }`}
                  >
                    <td className="py-2 px-3 font-mono">
                      {item.isDenominatorZero && <AlertTriangle size={14} className="inline mr-1 text-amber-400" />}
                      {item.name}
                    </td>
                    <td className="py-2 px-3 font-mono">{item.value}</td>
                    <td className="py-2 px-3 max-w-[260px]">
                      <button onClick={() => toggleRationale(item.id)} className="flex items-center gap-1 text-left">
                        {expandedRationale.has(item.id) ? <ChevronDown size={14} className="text-slate-400 flex-shrink-0" /> : <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />}
                        <span className="truncate">{item.rationale}</span>
                      </button>
                      {expandedRationale.has(item.id) && (
                        <div className="mt-1 p-2 bg-slate-900 rounded text-xs text-slate-300 whitespace-pre-wrap">{item.rationale}</div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-400">v{paramVersions.find((v) => v.id === item.versionId)?.version ?? '-'}</td>
                    <td className="py-2 px-3">
                      {item.reviewStatus === 'pending_review' && (
                        <span className="text-xs px-2 py-0.5 bg-amber-500/20 text-amber-400 rounded">待复核</span>
                      )}
                      {item.reviewStatus === 'reviewed' && (
                        <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded">已复核</span>
                      )}
                      {item.reviewStatus === 'normal' && (
                        <span className="text-xs text-slate-500">正常</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
