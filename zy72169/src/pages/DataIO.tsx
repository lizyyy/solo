import { useEffect, useState, useRef, useCallback } from 'react'
import { useLocationStore } from '@/stores/locationStore'
import { useFeedbackStore } from '@/stores/feedbackStore'
import { useOperationLogStore } from '@/stores/operationLogStore'
import { parseFile } from '@/services/importService'
import { exportToCSV, downloadCSV } from '@/services/exportService'
import { computeDiff, formatDiffSummary } from '@/services/diffService'

import {
  ArrowRightLeft,
  Upload,
  Download,
  Plus,
  FileUp,
  AlertTriangle,
  Check,
  FileDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LocationStatus, DataSource, ImportRow, DiffEntry } from '@/types'

type TabKey = '批量导入' | '补录与导出'

const STATUS_OPTIONS: LocationStatus[] = ['规划中', '施工中', '已启用', '暂停']
const SOURCE_OPTIONS: DataSource[] = ['表格', '照片', '审批记录', '手动补录']

const TABS: { key: TabKey; icon: React.ReactNode }[] = [
  { key: '批量导入', icon: <FileUp size={16} /> },
  { key: '补录与导出', icon: <ArrowRightLeft size={16} /> },
]

interface ManualForm {
  originalName: string
  canonicalName: string
  address: string
  chargerCount: string
  status: LocationStatus
  source: DataSource
  rawNote: string
}

const EMPTY_FORM: ManualForm = {
  originalName: '',
  canonicalName: '',
  address: '',
  chargerCount: '',
  status: '规划中',
  source: '表格',
  rawNote: '',
}

export default function DataIO() {
  const { locations, aliases, loadAll: loadLocations, addLocation, checkMergeSuggestions } = useLocationStore()
  const { feedbacks, loadAll: loadFeedbacks } = useFeedbackStore()
  const { addLog } = useOperationLogStore()

  const [activeTab, setActiveTab] = useState<TabKey>('批量导入')
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState('')

  const [form, setForm] = useState<ManualForm>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [diffEntries, setDiffEntries] = useState<DiffEntry[]>([])

  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadLocations()
    loadFeedbacks()
  }, [loadLocations, loadFeedbacks])

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name)
    setParsing(true)
    setImportResult('')
    try {
      const rows = await parseFile(file)
      setImportRows(rows)
    } catch {
      setImportRows([])
      setImportResult('文件解析失败，请检查文件格式')
    } finally {
      setParsing(false)
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  async function handleImport() {
    if (importRows.length === 0) return
    setImporting(true)
    try {
      const before = [...useLocationStore.getState().locations]
      let anomalyCount = 0

      for (const row of importRows) {
        const p = row.parsed
        const added = await addLocation({
          originalName: p.originalName ?? '',
          canonicalName: p.canonicalName ?? p.originalName ?? '',
          address: p.address ?? '',
          chargerCount: p.chargerCount ?? 0,
          status: (p.status as LocationStatus) ?? '规划中',
          source: (p.source as DataSource) ?? '表格',
          sourceDetail: `导入自 ${fileName}`,
          mergeStatus: '未归并',
          mergedIntoId: null,
          isException: row.isAnomaly,
          exceptionNote: row.isAnomaly ? row.errors.join('；') : '',
          rawNote: p.rawNote ?? '',
        })
        if (row.isAnomaly) anomalyCount++
        await checkMergeSuggestions(added.id)
      }

      const after = useLocationStore.getState().locations
      const diff = computeDiff(before, after)

      await addLog({
        type: '导入',
        summary: `成功导入${importRows.length}条点位（含${anomalyCount}条异常）`,
        detail: formatDiffSummary(diff),
        operator: '系统',
      })

      setImportResult(`成功导入${importRows.length}条点位（含${anomalyCount}条异常）`)
      setImportRows([])
      setFileName('')
    } finally {
      setImporting(false)
    }
  }

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.originalName.trim()) return
    setSubmitting(true)
    try {
      const before = [...useLocationStore.getState().locations]

      const added = await addLocation({
        originalName: form.originalName.trim(),
        canonicalName: form.canonicalName.trim() || form.originalName.trim(),
        address: form.address.trim(),
        chargerCount: Number(form.chargerCount) || 0,
        status: form.status,
        source: '手动补录',
        sourceDetail: '手动补录',
        mergeStatus: '未归并',
        mergedIntoId: null,
        isException: false,
        exceptionNote: '',
        rawNote: form.rawNote.trim(),
      })

      await checkMergeSuggestions(added.id)

      const after = useLocationStore.getState().locations
      const diff = computeDiff(before, after)
      setDiffEntries(diff)

      await addLog({
        type: '补录',
        summary: `补录点位「${form.originalName.trim()}」`,
        detail: formatDiffSummary(diff),
        operator: '系统',
      })

      setForm(EMPTY_FORM)
    } finally {
      setSubmitting(false)
    }
  }

  async function handleExport() {
    const csv = exportToCSV(locations, aliases, feedbacks)
    downloadCSV(csv, `点位导出_${new Date().toISOString().slice(0, 10)}.csv`)
    await addLog({
      type: '导出',
      summary: `导出${locations.length}条点位`,
      detail: `共${locations.length}条`,
      operator: '系统',
    })
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 px-6 py-4 border-b border-zinc-800 bg-zinc-950">
        <ArrowRightLeft size={20} className="text-teal-400 flex-shrink-0" />
        <h1 className="text-lg font-semibold text-zinc-100 whitespace-nowrap">数据导入导出</h1>
      </header>

      <div className="flex items-center gap-1 px-6 py-2 border-b border-zinc-800 bg-zinc-950/80">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition',
              activeTab === tab.key
                ? 'bg-zinc-800 text-teal-400'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50',
            )}
          >
            {tab.icon}
            {tab.key}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-6">
        {activeTab === '批量导入' && (
          <div className="mx-auto max-w-4xl space-y-6">
            <div
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 transition-colors cursor-pointer',
                dragOver
                  ? 'border-teal-500 bg-teal-950/30'
                  : 'border-zinc-700 bg-zinc-900 hover:border-zinc-600',
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={36} className={dragOver ? 'text-teal-400' : 'text-zinc-500'} />
              <p className="text-sm text-zinc-400">拖拽CSV/Excel文件到此处</p>
              <button
                type="button"
                className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition"
              >
                选择文件
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>

            {parsing && (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-teal-400" />
                正在解析文件…
              </div>
            )}

            {fileName && !parsing && importRows.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-zinc-400">
                    文件：<span className="text-zinc-200">{fileName}</span>（共 {importRows.length} 行）
                  </p>
                  <button
                    onClick={handleImport}
                    disabled={importing}
                    className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50 transition"
                  >
                    <Check size={14} />
                    {importing ? '导入中…' : '确认导入'}
                  </button>
                </div>

                <div className="overflow-auto max-h-96 rounded-lg border border-zinc-800">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-zinc-900 text-zinc-400 text-left">
                      <tr>
                        <th className="px-3 py-2.5 font-medium">行号</th>
                        <th className="px-3 py-2.5 font-medium">点位名称</th>
                        <th className="px-3 py-2.5 font-medium">地址</th>
                        <th className="px-3 py-2.5 font-medium text-right">数量</th>
                        <th className="px-3 py-2.5 font-medium">状态</th>
                        <th className="px-3 py-2.5 font-medium">来源</th>
                        <th className="px-3 py-2.5 font-medium">备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importRows.map((row) => (
                        <tr
                          key={row.rowIndex}
                          className={cn(
                            'border-t border-zinc-800/60',
                            row.isAnomaly
                              ? 'border-l-2 border-l-red-500 bg-red-950/20'
                              : 'bg-zinc-900/50',
                          )}
                        >
                          <td className="px-3 py-2 text-zinc-500 font-mono-num">
                            {row.isAnomaly && <AlertTriangle size={12} className="inline mr-1 text-red-400" />}
                            {row.rowIndex}
                          </td>
                          <td className="px-3 py-2 text-zinc-300">
                            {row.parsed.originalName ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-zinc-400 max-w-[180px] truncate">
                            {row.parsed.address ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono-num text-zinc-200">
                            {row.parsed.chargerCount ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-zinc-400">
                            {row.parsed.status ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-zinc-400">
                            {row.parsed.source ?? '—'}
                          </td>
                          <td className="px-3 py-2 text-zinc-400 max-w-[160px] truncate">
                            {row.isAnomaly ? (
                              <span className="text-red-400" title={row.errors.join('；')}>
                                {row.errors.join('；')}
                              </span>
                            ) : (
                              row.parsed.rawNote ?? '—'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {importResult && (
              <div
                className={cn(
                  'rounded-lg px-4 py-3 text-sm',
                  importResult.includes('失败')
                    ? 'bg-red-950/40 text-red-300 ring-1 ring-red-800'
                    : 'bg-teal-950/40 text-teal-300 ring-1 ring-teal-800',
                )}
              >
                {importResult}
              </div>
            )}
          </div>
        )}

        {activeTab === '补录与导出' && (
          <div className="mx-auto max-w-4xl space-y-8">
            <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-5">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <Plus size={16} className="text-teal-400" />
                补录表单
              </h2>

              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1.5 block text-xs text-zinc-400">
                      点位名称 <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.originalName}
                      onChange={(e) => setForm((f) => ({ ...f, originalName: e.target.value }))}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition"
                      placeholder="输入点位名称"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-zinc-400">标准名称</label>
                    <input
                      type="text"
                      value={form.canonicalName}
                      onChange={(e) => setForm((f) => ({ ...f, canonicalName: e.target.value }))}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition"
                      placeholder="可选，留空则使用点位名称"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="mb-1.5 block text-xs text-zinc-400">地址</label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition"
                      placeholder="输入地址"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-zinc-400">充电桩数量</label>
                    <input
                      type="number"
                      min="0"
                      value={form.chargerCount}
                      onChange={(e) => setForm((f) => ({ ...f, chargerCount: e.target.value }))}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-zinc-400">状态</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as LocationStatus }))}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-teal-600 transition"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-zinc-400">来源</label>
                    <select
                      value={form.source}
                      onChange={(e) => setForm((f) => ({ ...f, source: e.target.value as DataSource }))}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300 outline-none focus:border-teal-600 transition"
                    >
                      {SOURCE_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs text-zinc-400">备注</label>
                    <input
                      type="text"
                      value={form.rawNote}
                      onChange={(e) => setForm((f) => ({ ...f, rawNote: e.target.value }))}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-teal-600 focus:ring-1 focus:ring-teal-600 transition"
                      placeholder="可选备注"
                    />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting || !form.originalName.trim()}
                    className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-5 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-50 transition"
                  >
                    <Plus size={14} />
                    {submitting ? '提交中…' : '提交补录'}
                  </button>
                </div>
              </form>

              {diffEntries.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">变更差异</h3>
                  <div className="space-y-1.5">
                    {diffEntries.map((entry, i) => (
                      <div
                        key={i}
                        className={cn(
                          'rounded-md px-3 py-2 text-sm ring-1',
                          entry.type === 'added'
                            ? 'bg-green-950/30 text-green-300 ring-green-800'
                            : entry.type === 'modified'
                              ? 'bg-amber-950/30 text-amber-300 ring-amber-800'
                              : 'bg-red-950/30 text-red-300 ring-red-800',
                        )}
                      >
                        <span className="font-medium">
                          {entry.type === 'added' ? '新增' : entry.type === 'modified' ? '修改' : '移除'}
                        </span>
                        {' · '}
                        {entry.entity}
                        {entry.field && (
                          <span className="text-zinc-400">
                            {' · '}{entry.field}：{entry.before ?? '—'} → {entry.after ?? '—'}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 space-y-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                <FileDown size={16} className="text-teal-400" />
                导出
              </h2>

              <p className="text-sm text-zinc-400">
                当前共有 <span className="font-mono-num text-zinc-200">{locations.length}</span> 条点位数据
              </p>

              <div className="flex justify-end">
                <button
                  onClick={handleExport}
                  disabled={locations.length === 0}
                  className="flex items-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-800 px-5 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 transition"
                >
                  <Download size={14} />
                  导出CSV
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
