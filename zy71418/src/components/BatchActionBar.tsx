import { useReconciliationStore } from '@/store'
import { STATUS_LABELS } from '@/types'
import type { ReconciliationStatus } from '@/types'
import { Download, CheckCircle2, Eye } from 'lucide-react'

function formatAmount(v: number) {
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function exportCSV(records: ReturnType<ReturnType<typeof useReconciliationStore.getState>['filteredRecords']>) {
  const headers = ['ID', '经纪商', '订单号', '市场', '撮合费', '成交回报费', '差异金额', '差异类型', '状态', '创建时间', '更新时间']
  const rows = records.map(r => [
    r.id,
    r.brokerName,
    r.orderId,
    r.market,
    r.matchingFee,
    r.tradeReportFee,
    r.diffAmount,
    r.diffTypes.join(';'),
    STATUS_LABELS[r.status as ReconciliationStatus],
    r.createdAt,
    r.updatedAt,
  ])
  const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `撮合费对账_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function BatchActionBar() {
  const { selectedIds, updateStatus, clearSelection, filteredRecords } = useReconciliationStore()
  const records = filteredRecords()
  const count = selectedIds.size

  if (count === 0) {
    return (
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/80 border-t border-slate-700/50">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            共 <span className="font-mono-amount text-slate-200">{records.length}</span> 条记录
          </span>
          <span className="text-xs text-slate-500">
            导出将包含当前筛选范围内的全部 <span className="font-mono-amount text-slate-400">{records.length}</span> 条记录
          </span>
        </div>
        <button
          onClick={() => exportCSV(records)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-slate-800 border border-slate-600/50 text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors"
        >
          <Download size={13} />
          导出当前范围
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-blue-950/40 border-t border-blue-800/30">
      <div className="flex items-center gap-4">
        <span className="text-xs text-blue-300">
          已选择 <span className="font-mono-amount font-semibold">{count}</span> 条记录
        </span>
        <button
          onClick={clearSelection}
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          取消选择
        </button>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => { updateStatus(Array.from(selectedIds), 'confirmed'); clearSelection() }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-emerald-600/15 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/25 transition-colors"
        >
          <CheckCircle2 size={13} />
          批量确认
        </button>
        <button
          onClick={() => { updateStatus(Array.from(selectedIds), 'review'); clearSelection() }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-amber-600/15 border border-amber-500/30 text-amber-400 hover:bg-amber-600/25 transition-colors"
        >
          <Eye size={13} />
          批量待复核
        </button>
        <div className="w-px h-5 bg-slate-700 mx-1" />
        <button
          onClick={() => exportCSV(records)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-slate-800 border border-slate-600/50 text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors"
        >
          <Download size={13} />
          导出当前范围
        </button>
      </div>
    </div>
  )
}
