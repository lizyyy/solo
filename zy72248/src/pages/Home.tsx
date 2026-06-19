import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import {
  Upload, Download, ShieldCheck, Search, ChevronLeft, ChevronRight, X,
  CheckCircle2, XCircle, FileUp,
} from 'lucide-react'
import { useBillStore } from '@/store/billStore'
import { cn } from '@/lib/utils'
import type { BillItem, BillStatus, MaterialType, RiskReviewStatus, SelfCheckType, SelfCheckResult, LastExportSnapshot } from '@/types'
import { STATUS_LABELS, MATERIAL_TYPE_LABELS, SELF_CHECK_LABELS } from '@/types'

const PAGE_SIZE = 10

const STATUS_BADGE: Record<BillStatus, string> = {
  normal: 'bg-emerald-50 text-emerald-500 border-emerald-200',
  wrong_caliber: 'bg-gray-100 text-gray-600 border-gray-200',
  supplement: 'bg-blue-50 text-blue-600 border-blue-200',
  conflict: 'bg-amber-50 text-amber-500 border-amber-200',
  risk_review: 'bg-crimson-50 text-crimson-500 border-crimson-200',
}

const SELF_CHECK_ORDER: SelfCheckType[] = ['duplicate_import', 'zero_with_reversal', 'supplement_recalc', 'export_consistency']

export default function Home() {
  const navigate = useNavigate()
  const items = useBillStore((s) => s.items)
  const selfCheckResults = useBillStore((s) => s.selfCheckResults)
  const selfCheckDrawerOpen = useBillStore((s) => s.selfCheckDrawerOpen)
  const importModalOpen = useBillStore((s) => s.importModalOpen)
  const history = useBillStore((s) => s.history)
  const setSelfCheckDrawerOpen = useBillStore((s) => s.setSelfCheckDrawerOpen)
  const setImportModalOpen = useBillStore((s) => s.setImportModalOpen)
  const setLastExportSnapshot = useBillStore((s) => s.setLastExportSnapshot)
  const importItems = useBillStore((s) => s.importItems)
  const runSelfCheck = useBillStore((s) => s.runSelfCheck)
  const addHistoryRecord = useBillStore((s) => s.addHistoryRecord)

  const [statusFilter, setStatusFilter] = useState<BillStatus | ''>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [materialType, setMaterialType] = useState<MaterialType>('normal')

  const filtered = items.filter((it) => {
    if (statusFilter && it.status !== statusFilter) return false
    if (search && !it.billNo.includes(search)) return false
    return true
  })
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const handleExport = useCallback(() => {
    const rows = filtered.map((it) => ({
      票据号: it.billNo, 金额: it.amount, 税费率备注: it.taxRateRemark,
      柜台流水尾号: it.counterTxnTailNo, 备注: it.remark, 状态: STATUS_LABELS[it.status],
    }))

    const statusDistribution: Record<string, number> = {}
    for (const it of filtered) {
      const label = STATUS_LABELS[it.status]
      statusDistribution[label] = (statusDistribution[label] || 0) + 1
    }

    const itemsState = filtered.map((it) => ({
      id: it.id,
      billNo: it.billNo,
      status: it.status,
      taxRateRemark: it.taxRateRemark,
      remark: it.remark,
      summaryUpdated: it.summaryUpdated,
      conflictResolution: it.conflictResolution,
      riskReviewStatus: it.riskReviewStatus,
    }))

    const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)
    const fileName = `票据影像补录清单_${ts}.xlsx`
    const exportTime = new Date().toISOString().replace('T', ' ').slice(0, 19)

    const snapshot: LastExportSnapshot = {
      exportTime,
      fileName,
      recordCount: filtered.length,
      fields: ['票据号', '金额', '税费率备注', '柜台流水尾号', '备注', '状态'],
      rows,
      statusDistribution,
      itemsState,
      historyCount: history.length,
      lastHistoryIds: history.slice(0, 5).map((h) => h.id),
    }

    setLastExportSnapshot(snapshot)

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '票据清单')
    XLSX.writeFile(wb, fileName)

    addHistoryRecord({
      billItemId: '', action: 'export', operator: '阿芬',
      timestamp: exportTime,
      beforeSnapshot: '{}', afterSnapshot: JSON.stringify({ count: filtered.length, fileName }),
      detail: `导出 ${filtered.length} 条记录，文件名：${fileName}`,
    })
  }, [filtered, history, setLastExportSnapshot, addHistoryRecord])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const handleFile = useCallback((file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true, skipEmptyLines: true,
      complete(results) {
        const newItems: BillItem[] = results.data.map((row, i) => {
          const amount = parseFloat(row['金额'] || row['amount'] || '0')
          const remark = row['备注'] || row['remark'] || ''
          const isZeroWithReversal = amount === 0 && remark === '已冲正'
          return {
            id: `IMP-${Date.now()}-${i}`,
            billNo: row['票据号'] || row['billNo'] || '',
            amount,
            taxRateRemark: row['税费率备注'] || row['taxRateRemark'] || '',
            counterTxnTailNo: row['柜台流水尾号'] || row['counterTxnTailNo'] || '',
            remark,
            status: (isZeroWithReversal ? 'risk_review' : 'normal') as BillStatus,
            materialType,
            importBatch: '', importTime: '',
            isZeroWithReversal,
            conflictResolved: true,
            riskReviewStatus: (isZeroWithReversal ? 'pending' : undefined) as RiskReviewStatus | undefined,
            supplementStep: 0 as const, summaryUpdated: false,
          }
        })
        importItems(newItems, materialType)
        setImportModalOpen(false)
      },
    })
  }, [materialType, importItems, setImportModalOpen])

  const [dragOver, setDragOver] = useState(false)
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  return (
    <div className="h-full flex flex-col p-6 gap-4">
      <FilterBar
        statusFilter={statusFilter} setStatusFilter={(v) => { setStatusFilter(v); setPage(1) }}
        search={search} setSearch={(v) => { setSearch(v); setPage(1) }}
        onImport={() => setImportModalOpen(true)} onExport={handleExport}
        onSelfCheck={() => { runSelfCheck(); setSelfCheckDrawerOpen(true) }}
      />

      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-navy-500 text-white text-xs">
              {['票据号', '金额', '税费率备注', '柜台流水尾号', '备注', '状态', '操作'].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-semibold tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((it, idx) => (
              <tr key={it.id} className={cn(
                'border-b border-gray-100 transition-colors',
                idx % 2 === 1 && 'bg-gray-50/60',
                it.status === 'conflict' && 'bg-amber-50',
                it.isZeroWithReversal && 'bg-crimson-50',
              )}>
                <td className="px-4 py-3 font-mono font-semibold text-navy-500">{it.billNo}</td>
                <td className="px-4 py-3 font-mono">{it.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 font-mono">{it.taxRateRemark}</td>
                <td className="px-4 py-3 font-mono">{it.counterTxnTailNo}</td>
                <td className="px-4 py-3 max-w-[120px] truncate">{it.remark || '—'}</td>
                <td className="px-4 py-3">
                  <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', STATUS_BADGE[it.status])}>
                    {STATUS_LABELS[it.status]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <RowActions item={it} navigate={navigate} />
                </td>
              </tr>
            ))}
            {paged.length === 0 && (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">暂无数据</td></tr>
            )}
          </tbody>
        </table>

        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500 mt-auto">
          <span>共 {filtered.length} 条</span>
          <div className="flex items-center gap-2">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronLeft size={16} />
            </button>
            <span className="font-mono">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      {selfCheckDrawerOpen && (
        <SelfCheckDrawer
          results={selfCheckResults}
          onClose={() => setSelfCheckDrawerOpen(false)}
        />
      )}

      {importModalOpen && (
        <ImportModal
          materialType={materialType} setMaterialType={setMaterialType}
          dragOver={dragOver} setDragOver={setDragOver}
          onDrop={handleDrop} onFileSelect={handleFile}
          fileInputRef={fileInputRef}
          onClose={() => setImportModalOpen(false)}
        />
      )}
    </div>
  )
}

function FilterBar({ statusFilter, setStatusFilter, search, setSearch, onImport, onExport, onSelfCheck }: {
  statusFilter: BillStatus | ''; setStatusFilter: (v: BillStatus | '') => void
  search: string; setSearch: (v: string) => void
  onImport: () => void; onExport: () => void; onSelfCheck: () => void
}) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as BillStatus | '')}
        className="h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-navy-300">
        <option value="">全部状态</option>
        {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索票据号"
          className="h-9 pl-9 pr-3 w-52 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300" />
      </div>
      <div className="flex-1" />
      <button onClick={onImport}
        className="h-9 px-4 rounded-lg bg-navy-500 text-white text-sm font-medium hover:bg-navy-400 flex items-center gap-1.5 transition-colors">
        <Upload size={14} /> 导入
      </button>
      <button onClick={onExport}
        className="h-9 px-4 rounded-lg border border-gray-200 text-sm font-medium hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
        <Download size={14} /> 导出
      </button>
      <button onClick={onSelfCheck}
        className="h-9 px-4 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 flex items-center gap-1.5 transition-colors">
        <ShieldCheck size={14} /> 自检
      </button>
    </div>
  )
}

function RowActions({ item, navigate }: { item: BillItem; navigate: ReturnType<typeof useNavigate> }) {
  if (item.status === 'conflict') {
    return <button onClick={() => navigate('/conflict')} className="text-amber-500 hover:text-amber-600 text-sm font-medium">裁决</button>
  }
  if (item.status === 'supplement') {
    return <button onClick={() => navigate('/supplement')} className="text-blue-600 hover:text-blue-700 text-sm font-medium">补录</button>
  }
  if (item.status === 'risk_review') {
    return <button onClick={() => navigate('/supplement')} className="text-crimson-500 hover:text-crimson-600 text-sm font-medium">风控复核</button>
  }
  return <span className="text-gray-300 text-sm">—</span>
}

function SelfCheckDrawer({ results, onClose }: { results: SelfCheckResult[]; onClose: () => void }) {
  const resultMap = new Map(results.map((r) => [r.type, r]))
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-96 bg-white shadow-2xl z-50 flex flex-col animate-in slide-in-from-right">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-bold text-navy-500">自检结果</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-auto p-6 space-y-4">
          {SELF_CHECK_ORDER.map((type) => {
            const r = resultMap.get(type)
            const passed = r?.passed ?? true
            const count = r?.items.length ?? 0
            return (
              <div key={type} className={cn('rounded-lg border p-4', passed ? 'border-emerald-200 bg-emerald-50' : 'border-crimson-200 bg-crimson-50')}>
                <div className="flex items-center gap-2">
                  {passed ? <CheckCircle2 size={18} className="text-emerald-500" /> : <XCircle size={18} className="text-crimson-500" />}
                  <span className="font-medium text-sm">{SELF_CHECK_LABELS[type]}</span>
                  {!passed && <span className="ml-auto text-xs font-mono text-crimson-500">{count} 条异常</span>}
                </div>
                {passed && <p className="text-xs text-emerald-600 mt-1 ml-7">检查通过</p>}
                {!passed && r && (
                  <ul className="mt-2 ml-7 space-y-1">
                    {r.items.map((it) => (
                      <li key={it.billItemId} className="text-xs text-crimson-500">{it.billNo}：{it.description}</li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

function ImportModal({ materialType, setMaterialType, dragOver, setDragOver, onDrop, onFileSelect, fileInputRef, onClose }: {
  materialType: MaterialType; setMaterialType: (v: MaterialType) => void
  dragOver: boolean; setDragOver: (v: boolean) => void
  onDrop: (e: React.DragEvent) => void; onFileSelect: (f: File) => void
  fileInputRef: React.RefObject<HTMLInputElement | null>; onClose: () => void
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl w-[480px] flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-bold text-navy-500">导入票据数据</h3>
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X size={18} /></button>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">材料类型</label>
              <select value={materialType} onChange={(e) => setMaterialType(e.target.value as MaterialType)}
                className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-navy-300">
                {Object.entries(MATERIAL_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors',
                dragOver ? 'border-navy-400 bg-navy-50' : 'border-gray-200 hover:border-navy-300',
              )}
            >
              <FileUp size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">拖拽 CSV 文件至此，或点击选择</p>
              <p className="text-xs text-gray-400 mt-1">支持含列头：票据号、金额、税费率备注、柜台流水尾号、备注</p>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f) }} />
          </div>
        </div>
      </div>
    </>
  )
}
