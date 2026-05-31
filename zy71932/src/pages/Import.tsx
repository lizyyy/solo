import { useState, useCallback } from 'react'
import { useStore } from '@/store'
import { Upload, FileText, AlertTriangle, CheckCircle2, XCircle, ArrowRight, Copy, SkipForward } from 'lucide-react'
import type { ImportRow, ConflictItem, ImportSession, ConflictResolution } from '@/types'

export default function ImportPage() {
  const { importFile, resolveConflictsAndImport, records, importSessions } = useStore()
  const [session, setSession] = useState<ImportSession | null>(null)
  const [rows, setRows] = useState<ImportRow[]>([])
  const [conflicts, setConflicts] = useState<ConflictItem[]>([])
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [importing, setImporting] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    setError('')
    try {
      const result = await importFile(file)
      setSession(result.session)
      setRows(result.rows)
      setConflicts(result.conflicts)
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败')
    }
  }, [importFile])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const setResolution = (index: number, resolution: ConflictResolution) => {
    setConflicts((prev) => prev.map((c) => c.index === index ? { ...c, resolution } : c))
  }

  const allResolved = conflicts.every((c) => c.resolution)

  const handleImport = async () => {
    if (!session) return
    setImporting(true)
    try {
      await resolveConflictsAndImport(session, rows, conflicts)
      setSession(null)
      setRows([])
      setConflicts([])
    } catch (e) {
      setError(e instanceof Error ? e.message : '处理失败')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="p-6 max-w-[1000px] mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-zinc-100">导入与复核</h2>
        <p className="text-sm text-zinc-500 mt-1">导入字体授权数据，自动检测重复和缺失字段</p>
      </div>

      {!session && (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          className={`card border-2 border-dashed transition-colors py-16 flex flex-col items-center justify-center gap-4 ${
            dragOver ? 'border-amber bg-amber/5' : 'border-surface-200'
          }`}
        >
          <Upload size={32} className={dragOver ? 'text-amber' : 'text-zinc-500'} />
          <div className="text-center">
            <p className="text-sm text-zinc-300">拖拽文件到此处，或点击选择</p>
            <p className="text-xs text-zinc-500 mt-1">支持 CSV / JSON 格式</p>
          </div>
          <label className="btn-primary cursor-pointer">
            选择文件
            <input type="file" accept=".csv,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </label>
        </div>
      )}

      {error && (
        <div className="card px-4 py-3 border-l-2 border-l-danger flex items-center gap-3">
          <XCircle size={16} className="text-danger shrink-0" />
          <span className="text-sm text-danger">{error}</span>
        </div>
      )}

      {session && (
        <>
          <div className="card px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-zinc-400" />
                <span className="text-sm text-zinc-200">{session.fileName}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <span>共 {session.totalRows} 行</span>
                <span className="text-confirm">新增 {session.newCount}</span>
                <span className="text-amber">冲突 {session.conflictCount}</span>
              </div>
            </div>
          </div>

          {conflicts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber" />
                检测到 {conflicts.length} 个重复项，请选择处理方式
              </h3>
              {conflicts.map((c) => (
                <div key={c.index} className="card px-4 py-3 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-sm text-zinc-200 font-medium font-mono">{c.importRow.fontName}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {c.importRow.foundry} · {c.importRow.licenseType} · v{c.importRow.colorCardVersion || '-'}
                      </div>
                    </div>
                    <span className="badge-pending">重复</span>
                  </div>
                  <div className="text-xs text-zinc-500 bg-surface/50 rounded px-3 py-2 font-mono">
                    <div>已有记录：{c.existingRecord.foundry} · 到期 {c.existingRecord.expiryDate || '无'} · 状态 {c.existingRecord.status}</div>
                    <div>导入数据：{c.importRow.foundry} · 到期 {c.importRow.expiryDate || '无'}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setResolution(c.index, 'overwrite')}
                      className={`text-xs px-3 py-1.5 rounded transition-colors ${
                        c.resolution === 'overwrite' ? 'bg-amber/20 text-amber' : 'bg-surface-100 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <ArrowRight size={12} className="inline mr-1" />覆盖
                    </button>
                    <button
                      onClick={() => setResolution(c.index, 'merge')}
                      className={`text-xs px-3 py-1.5 rounded transition-colors ${
                        c.resolution === 'merge' ? 'bg-confirm/20 text-confirm' : 'bg-surface-100 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <Copy size={12} className="inline mr-1" />合并（保留双方）
                    </button>
                    <button
                      onClick={() => setResolution(c.index, 'skip')}
                      className={`text-xs px-3 py-1.5 rounded transition-colors ${
                        c.resolution === 'skip' ? 'bg-surface-200 text-zinc-200' : 'bg-surface-100 text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      <SkipForward size={12} className="inline mr-1" />跳过
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {rows.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-zinc-300">导入预览</h3>
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-surface-200 text-left text-xs text-zinc-500">
                      <th className="py-2 px-3 font-medium">字体名称</th>
                      <th className="py-2 px-3 font-medium">厂商</th>
                      <th className="py-2 px-3 font-medium">授权类型</th>
                      <th className="py-2 px-3 font-medium">到期日</th>
                      <th className="py-2 px-3 font-medium">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const isConflict = conflicts.some((c) => c.index === i)
                      const missingExpiry = !row.expiryDate
                      return (
                        <tr key={i} className={`border-b border-surface-200/50 ${isConflict ? 'bg-amber/5' : ''}`}>
                          <td className="py-2 px-3 font-mono text-zinc-300">{row.fontName}</td>
                          <td className="py-2 px-3 text-zinc-400">{row.foundry}</td>
                          <td className="py-2 px-3 text-zinc-400">{row.licenseType}</td>
                          <td className="py-2 px-3 font-mono">
                            {row.expiryDate ? <span className="text-zinc-400">{row.expiryDate}</span> : <span className="text-amber">缺失</span>}
                          </td>
                          <td className="py-2 px-3">
                            {isConflict ? (
                              <span className="badge-pending">重复</span>
                            ) : missingExpiry ? (
                              <span className="badge-pending">待确认</span>
                            ) : (
                              <span className="badge-confirmed">新增</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button onClick={() => { setSession(null); setRows([]); setConflicts([]) }} className="btn-secondary">
              取消
            </button>
            <div className="flex items-center gap-3">
              {conflicts.length > 0 && !allResolved && (
                <span className="text-xs text-amber">请处理所有冲突项后继续</span>
              )}
              <button
                onClick={handleImport}
                disabled={(conflicts.length > 0 && !allResolved) || importing}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? '处理中...' : `确认导入 (${rows.length} 条)`}
              </button>
            </div>
          </div>
        </>
      )}

      {importSessions.length > 0 && !session && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-confirm" />
            导入历史
          </h3>
          {importSessions.slice().reverse().map((s) => (
            <div key={s.id} className="card px-4 py-3 flex items-center justify-between">
              <div>
                <span className="text-sm text-zinc-300">{s.fileName}</span>
                <div className="text-xs text-zinc-500 mt-0.5 font-mono">{new Date(s.timestamp).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-confirm">+{s.newCount}</span>
                <span className="text-amber">~{s.updateCount}</span>
                <span className="text-zinc-500">⊘{s.skipCount}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
