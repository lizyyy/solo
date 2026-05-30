import { useReconciliationStore } from '@/store'
import { DIFF_TYPE_LABELS, STATUS_LABELS, MARKET_LABELS } from '@/types'
import type { DiffType, ReconciliationStatus, Market } from '@/types'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

function formatAmount(v: number) {
  return v.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const h = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${m}-${day} ${h}:${min}`
}

export default function RecordList() {
  const { selectedIds, toggleSelect, toggleSelectAll, filteredRecords } = useReconciliationStore()
  const navigate = useNavigate()
  const records = filteredRecords()

  const allIds = records.map(r => r.id)
  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id))

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 z-10">
          <tr className="bg-slate-900/95 backdrop-blur-sm text-slate-400 border-b border-slate-700/50">
            <th className="w-9 py-2.5 px-2 text-left">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => toggleSelectAll(allIds)}
                className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/30 focus:ring-offset-0"
              />
            </th>
            <th className="py-2.5 px-2 text-left font-medium">经纪商</th>
            <th className="py-2.5 px-2 text-left font-medium">订单号</th>
            <th className="py-2.5 px-2 text-left font-medium">市场</th>
            <th className="py-2.5 px-2 text-right font-medium">撮合费</th>
            <th className="py-2.5 px-2 text-right font-medium">成交回报费</th>
            <th className="py-2.5 px-2 text-right font-medium">差异金额</th>
            <th className="py-2.5 px-2 text-left font-medium">差异类型</th>
            <th className="py-2.5 px-2 text-left font-medium">状态</th>
            <th className="py-2.5 px-2 text-left font-medium">更新时间</th>
            <th className="w-8"></th>
          </tr>
        </thead>
        <tbody>
          {records.map(r => (
            <tr
              key={r.id}
              className={`record-row border-b border-slate-800/60 cursor-pointer ${
                selectedIds.has(r.id) ? 'bg-blue-900/15' : ''
              }`}
              onClick={() => navigate(`/detail/${r.id}`)}
            >
              <td className="py-2.5 px-2" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(r.id)}
                  onChange={() => toggleSelect(r.id)}
                  className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/30 focus:ring-offset-0"
                />
              </td>
              <td className="py-2.5 px-2 text-slate-200 font-medium">{r.brokerName}</td>
              <td className="py-2.5 px-2 font-mono-amount text-slate-300">{r.orderId}</td>
              <td className="py-2.5 px-2 text-slate-400">{MARKET_LABELS[r.market as Market]}</td>
              <td className="py-2.5 px-2 text-right font-mono-amount text-slate-200">
                ¥{formatAmount(r.matchingFee)}
              </td>
              <td className="py-2.5 px-2 text-right font-mono-amount text-slate-200">
                ¥{formatAmount(r.tradeReportFee)}
              </td>
              <td className={`py-2.5 px-2 text-right font-mono-amount font-medium ${
                r.diffAmount > 0 ? 'text-amber-400' : r.diffAmount < 0 ? 'text-rose-400' : 'text-slate-500'
              }`}>
                {r.diffAmount > 0 ? '+' : ''}{formatAmount(r.diffAmount)}
              </td>
              <td className="py-2.5 px-2">
                <div className="flex flex-wrap gap-1">
                  {r.diffTypes.length === 0 ? (
                    <span className="text-slate-600">—</span>
                  ) : (
                    r.diffTypes.map(dt => (
                      <span key={dt} className={`diff-tag diff-tag-${dt}`}>
                        {DIFF_TYPE_LABELS[dt as DiffType]}
                      </span>
                    ))
                  )}
                </div>
              </td>
              <td className="py-2.5 px-2">
                <span className={`status-badge status-${r.status as ReconciliationStatus}`}>
                  {STATUS_LABELS[r.status as ReconciliationStatus]}
                </span>
              </td>
              <td className="py-2.5 px-2 text-slate-400">{formatDateTime(r.updatedAt)}</td>
              <td className="py-2.5 px-1">
                <ChevronRight size={14} className="text-slate-600" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {records.length === 0 && (
        <div className="flex items-center justify-center py-20 text-slate-500 text-sm">
          当前筛选条件下无记录
        </div>
      )}
    </div>
  )
}
