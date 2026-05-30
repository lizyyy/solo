import { useGameStore } from '../store/gameStore'
import { LEDGER_TYPE_LABELS } from '../engine/types'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ArrowDownRight, FileText } from 'lucide-react'

export function LedgerTable() {
  const { ledger } = useGameStore()

  const groupedEntries = ledger.reduce((acc, entry) => {
    if (!acc[entry.round]) acc[entry.round] = []
    acc[entry.round].push(entry)
    return acc
  }, {} as Record<number, typeof ledger>)

  const rounds = Object.keys(groupedEntries).map(Number).sort((a, b) => b - a)

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-900">
          <tr>
            <th className="px-4 py-3 text-left text-slate-400 font-medium">回合</th>
            <th className="px-4 py-3 text-left text-slate-400 font-medium">类型</th>
            <th className="px-4 py-3 text-left text-slate-400 font-medium">金额</th>
            <th className="px-4 py-3 text-left text-slate-400 font-medium">订单</th>
            <th className="px-4 py-3 text-left text-slate-400 font-medium">描述</th>
            <th className="px-4 py-3 text-left text-slate-400 font-medium">详情</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {rounds.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                暂无流水记录
              </td>
            </tr>
          ) : (
            rounds.map(round => (
              groupedEntries[round].map((entry, i) => (
                <tr key={entry.id} className="hover:bg-slate-700/50">
                  {i === 0 && (
                    <td
                      rowSpan={groupedEntries[round].length}
                      className="px-4 py-3 text-amber-400 font-bold align-top"
                    >
                      R{round}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className={`
                      inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs
                      ${entry.type === 'income' ? 'bg-green-900/50 text-green-400' : ''}
                      ${entry.type === 'cabin_fee' ? 'bg-slate-700 text-slate-300' : ''}
                      ${entry.type === 'breach_penalty' ? 'bg-red-900/50 text-red-400' : ''}
                      ${entry.type === 'overbooking_penalty' ? 'bg-red-900/50 text-red-400' : ''}
                    `}>
                      {entry.amount > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      {LEDGER_TYPE_LABELS[entry.type]}
                    </span>
                  </td>
                  <td className={`px-4 py-3 font-mono font-bold ${
                    entry.amount > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {entry.amount > 0 ? '+' : ''}¥{entry.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-300">
                    {entry.orderId || '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-400 max-w-md truncate">
                    {entry.description}
                  </td>
                  <td className="px-4 py-3">
                    {entry.orderId && (
                      <Link
                        to={`/report?order=${entry.orderId}`}
                        className="text-amber-400 hover:text-amber-300 inline-flex items-center gap-1"
                      >
                        <FileText size={14} />
                        追溯
                      </Link>
                    )}
                  </td>
                </tr>
              ))
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
