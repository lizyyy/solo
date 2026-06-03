import { type Entry } from '@/store'
import { Pencil, ShieldCheck, Wrench } from 'lucide-react'

interface EntryTableProps {
  entries: Entry[]
  onNote: (entry: Entry) => void
  onReview: (entry: Entry) => void
  onCorrect: (entry: Entry) => void
}

const statusConfig: Record<string, { label: string; className: string }> = {
  normal: { label: '正常', className: 'bg-ledger-green-light text-ledger-green' },
  pending_review: { label: '待风控复核', className: 'bg-ledger-red-light text-ledger-red' },
  reviewed: { label: '已复核', className: 'bg-blue-50 text-blue-600' },
  corrected: { label: '已修正', className: 'bg-ledger-amber-light text-ledger-amber' },
}

export default function EntryTable({ entries, onNote, onReview, onCorrect }: EntryTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border border-ledger-border bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ledger-border bg-ledger-bg/50">
            <th className="px-4 py-3 text-left font-medium text-ledger-muted">交易日期</th>
            <th className="px-4 py-3 text-left font-medium text-ledger-muted">除权日</th>
            <th className="px-4 py-3 text-left font-medium text-ledger-muted">证券代码</th>
            <th className="px-4 py-3 text-left font-medium text-ledger-muted">证券名称</th>
            <th className="px-4 py-3 text-right font-medium text-ledger-muted">金额</th>
            <th className="px-4 py-3 text-left font-medium text-ledger-muted">备注</th>
            <th className="px-4 py-3 text-left font-medium text-ledger-muted">税费率</th>
            <th className="px-4 py-3 text-left font-medium text-ledger-muted">状态</th>
            <th className="px-4 py-3 text-left font-medium text-ledger-muted">操作</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const isPending = entry.status === 'pending_review'
            const cfg = statusConfig[entry.status] || statusConfig.normal

            return (
              <tr
                key={entry.id}
                className={`border-b border-ledger-border last:border-b-0 hover:bg-ledger-bg/30 transition-colors ${
                  isPending ? 'border-l-4 border-l-ledger-red bg-ledger-red-light/50' : ''
                }`}
              >
                <td className="px-4 py-3 text-ledger-text font-mono text-xs">{entry.tradeDate}</td>
                <td className="px-4 py-3 text-ledger-text font-mono text-xs">{entry.exDividendDate || '—'}</td>
                <td className="px-4 py-3 text-ledger-text font-mono text-xs">{entry.securityCode}</td>
                <td className="px-4 py-3 text-ledger-text">{entry.securityName}</td>
                <td className="px-4 py-3 text-right font-mono text-ledger-text">{entry.amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</td>
                <td className="px-4 py-3 text-ledger-muted max-w-32 truncate">{entry.note || '—'}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {entry.taxRate != null ? `${entry.taxRate}%` : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cfg.className}`}>
                    {cfg.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {isPending && entry.taxRate == null && (
                      <button
                        onClick={() => onNote(entry)}
                        className="p-1.5 rounded-md text-ledger-amber hover:bg-ledger-amber-light transition-colors"
                        title="补录备注"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isPending && entry.taxRate != null && (
                      <button
                        onClick={() => onReview(entry)}
                        className="p-1.5 rounded-md text-blue-500 hover:bg-blue-50 transition-colors"
                        title="复核"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onCorrect(entry)}
                      className="p-1.5 rounded-md text-ledger-muted hover:bg-ledger-amber-light hover:text-ledger-amber transition-colors"
                      title="修正"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
          {entries.length === 0 && (
            <tr>
              <td colSpan={9} className="px-4 py-12 text-center text-ledger-muted">
                暂无条目数据
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
