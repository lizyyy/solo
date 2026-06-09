import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileSpreadsheet, Clock, Database, Download, Package, Repeat } from 'lucide-react'
import { useStore } from '@/store'

interface ImportResult {
  importedCount: number
  boundaryCount: number
  message?: string
  duplicateImportCount?: number
  batchId?: string
  originalListName?: string
  importHistory?: { time: string; batchId: string }[]
}

export default function Sampling() {
  const { samplingLists, loading, error, fetchSamplingLists, importSamplingList, exportSampling } = useStore()
  const navigate = useNavigate()
  const [listName, setListName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState<string | null>(null)

  useEffect(() => {
    fetchSamplingLists()
  }, [])

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setImportError('仅支持 CSV 文件')
      return
    }
    setImporting(true)
    setImportError(null)
    setImportResult(null)
    try {
      const name = listName || file.name.replace('.csv', '')
      const result = await importSamplingList(file, name)
      setImportResult(result)
      setListName('')
    } catch (e: any) {
      setImportError(e.message)
    } finally {
      setImporting(false)
    }
  }, [listName, importSamplingList])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }, [handleFile])

  const isDuplicate = importResult && (importResult.duplicateImportCount && importResult.duplicateImportCount > 1)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-100" style={{ fontFamily: 'var(--font-title)' }}>抽样名单管理</h2>
        <button
          onClick={() => exportSampling()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-700/50 border border-slate-600 text-slate-300 rounded-lg text-sm hover:bg-slate-700 hover:text-amber-500 transition-colors"
        >
          <Download size={16} />
          导出全部
        </button>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragOver ? 'border-amber-500 bg-amber-500/5' : 'border-slate-600 hover:border-slate-500'} bg-slate-800/30`}
      >
        <Upload size={40} className="mx-auto mb-3 text-slate-400" />
        <p className="text-slate-300 mb-2">拖拽 CSV 文件到此处上传</p>
        <div className="flex items-center justify-center gap-3">
          <input
            type="text"
            value={listName}
            onChange={e => setListName(e.target.value)}
            placeholder="名单名称（可选，默认为文件名）"
            className="bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 w-64"
          />
          <label className="px-4 py-2 bg-amber-500 text-slate-900 rounded-lg font-medium text-sm cursor-pointer hover:bg-amber-400 transition-colors">
            选择文件
            <input type="file" accept=".csv" onChange={handleFileInput} className="hidden" />
          </label>
        </div>
        {importing && <p className="text-amber-500 text-sm mt-2">正在导入...</p>}
        {importError && <p className="text-rose-500 text-sm mt-2">{importError}</p>}
        {importResult && (
          <div className={`mt-3 text-sm p-3 rounded-lg text-left ${isDuplicate ? 'bg-amber-500/10 border border-amber-500/30' : 'bg-emerald-500/10 border border-emerald-500/30'}`}>
            {isDuplicate ? (
              <div className="space-y-1">
                <p className="text-amber-400 font-medium">
                  这是第 {importResult.duplicateImportCount} 次导入相同数据 → 数量未翻倍
                </p>
                {importResult.originalListName && (
                  <p className="text-slate-400">原始名单：<span className="text-slate-300">{importResult.originalListName}</span></p>
                )}
                {importResult.batchId && (
                  <p className="text-slate-400">本次批次：<span className="font-mono text-slate-300">{importResult.batchId.slice(0, 8)}</span></p>
                )}
                {importResult.importHistory && importResult.importHistory.length > 0 && (
                  <p className="text-slate-400">
                    历史导入记录：
                    {importResult.importHistory.map((h, i) => (
                      <span key={i} className="ml-1">
                        {i > 0 && '、'}
                        <span className="text-slate-300">{new Date(h.time).toLocaleString('zh-CN')}</span>
                      </span>
                    ))}
                  </p>
                )}
              </div>
            ) : importResult.message ? (
              <p className="text-amber-400">{importResult.message}</p>
            ) : (
              <p className="text-emerald-400">
                导入成功！新增 {importResult.importedCount} 条，边界样本 {importResult.boundaryCount} 条
              </p>
            )}
          </div>
        )}
      </div>

      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">名称</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">记录数</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">导入批次</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">最后批次</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">重复导入</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">导入时间</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">状态</th>
              <th className="text-left px-4 py-3 text-sm text-slate-400 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {samplingLists.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-500">暂无抽样名单</td></tr>
            ) : (
              samplingLists.map(list => (
                <tr
                  key={list.id}
                  onClick={() => navigate(`/sampling/${list.id}`)}
                  className="border-b border-slate-700/30 hover:bg-slate-700/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-slate-200">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet size={16} className="text-slate-400" />
                      {list.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    <div className="flex items-center gap-1">
                      <Database size={14} className="text-slate-400" />
                      {list.recordCount}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <Package size={14} className="text-slate-400" />
                      <span>第{list.duplicateImportCount ?? 1}次</span>
                      {list.duplicateImportCount && list.duplicateImportCount > 1 && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-amber-500/10 text-amber-500">已有批次</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      {list.lastBatchTime
                        ? new Date(list.lastBatchTime).toLocaleString('zh-CN')
                        : new Date(list.importTime).toLocaleString('zh-CN')}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {list.duplicateImportCount && list.duplicateImportCount > 1 ? (
                      <div className="flex items-center gap-1 text-amber-500">
                        <Repeat size={14} />
                        <span>是</span>
                      </div>
                    ) : (
                      <span className="text-emerald-500">否</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400">
                    <div className="flex items-center gap-1">
                      <Clock size={14} />
                      {new Date(list.importTime).toLocaleString('zh-CN')}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${list.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-600/30 text-slate-400'}`}>
                      {list.status === 'active' ? '活跃' : '已归档'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={e => { e.stopPropagation(); exportSampling(list.id) }}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-slate-700/50 border border-slate-600 text-slate-400 rounded hover:bg-slate-700 hover:text-amber-500 transition-colors"
                    >
                      <Download size={12} />
                      导出名单
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
