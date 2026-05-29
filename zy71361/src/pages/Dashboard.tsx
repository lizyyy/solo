import { useState, useMemo } from 'react'
import { usePropStore } from '@/store'
import { StatusBadge } from '@/components/StatusBadge'
import { entryTypeLabel, anomalyTypeLabel } from '@/utils/report'
import type { BorrowStatus } from '@/types'

const anomalyColors: Record<string, string> = {
  duplicate_borrow: '#e74c3c',
  unconfirmed_damage: '#f39c12',
  late_return: '#e74c3c',
  pending_review: '#f39c12',
}

const anomalyIcons: Record<string, string> = {
  duplicate_borrow: '⚠',
  unconfirmed_damage: '🔧',
  late_return: '⏰',
  pending_review: '📋',
}

const statusOptions: { value: BorrowStatus | 'all'; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'borrowed', label: '借出' },
  { value: 'returned', label: '已返库' },
  { value: 'on_stage', label: '舞台上' },
  { value: 'pending_review', label: '待复核' },
]

export default function Dashboard() {
  const { props, borrowRecords, anomalies } = usePropStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<BorrowStatus | 'all'>('all')

  const activeBorrowPropIds = useMemo(() => {
    const ids = new Set<string>()
    borrowRecords.forEach((r) => {
      if (!r.isWithdrawn && (r.status === 'borrowed' || r.status === 'on_stage')) {
        ids.add(r.propId)
      }
    })
    return ids
  }, [borrowRecords])

  const inStockCount = props.length - activeBorrowPropIds.size
  const borrowedCount = borrowRecords.filter((r) => r.status === 'borrowed' && !r.isWithdrawn).length
  const onStageCount = borrowRecords.filter((r) => r.status === 'on_stage' && !r.isWithdrawn).length
  const pendingReviewCount = borrowRecords.filter((r) => r.status === 'pending_review' && !r.isWithdrawn).length

  const unresolvedAnomalies = anomalies.filter((a) => !a.resolved)

  const anomalyRecordIds = useMemo(() => {
    const ids = new Set<string>()
    unresolvedAnomalies.forEach((a) => ids.add(a.borrowRecordId))
    return ids
  }, [unresolvedAnomalies])

  const visibleRecords = useMemo(() => {
    return borrowRecords.filter((r) => {
      if (r.isWithdrawn) return false
      if (statusFilter !== 'all' && r.status !== statusFilter) return false
      if (search.trim()) {
        const prop = props.find((p) => p.id === r.propId)
        const q = search.trim().toLowerCase()
        const nameMatch = prop?.name.toLowerCase().includes(q)
        const codeMatch = prop?.code.toLowerCase().includes(q)
        const borrowerMatch = r.borrower.toLowerCase().includes(q)
        if (!nameMatch && !codeMatch && !borrowerMatch) return false
      }
      return true
    })
  }, [borrowRecords, statusFilter, search, props])

  const cards = [
    { label: '在库', count: inStockCount, color: '#3498db' },
    { label: '借出', count: borrowedCount, color: '#d4a843' },
    { label: '舞台上', count: onStageCount, color: '#9b59b6' },
    { label: '待复核', count: pendingReviewCount, color: '#f39c12' },
  ]

  return (
    <div className="min-h-screen bg-[#0f0f1a] p-6 text-white">
      <h1 className="mb-6 text-2xl font-bold tracking-wide" style={{ color: '#d4a843' }}>
        出入库看板
      </h1>

      {/* Status Summary Cards */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl bg-[#1e1e32] p-5"
            style={{ borderLeft: `4px solid ${card.color}` }}
          >
            <div className="mb-1 text-sm text-gray-400">{card.label}</div>
            <div
              className="text-4xl font-bold"
              style={{
                color: card.color,
                textShadow: `0 0 20px ${card.color}66`,
              }}
            >
              {card.count}
            </div>
          </div>
        ))}
      </div>

      {/* Anomaly Alert Banner */}
      <div className="mb-6 rounded-xl bg-[#1e1e32] p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
          异常提醒
        </div>
        {unresolvedAnomalies.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <span className="text-base">✅</span> 无异常
          </div>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {unresolvedAnomalies.map((a) => (
              <div
                key={a.id}
                className="flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs"
                style={{
                  borderColor: `${anomalyColors[a.type]}55`,
                  backgroundColor: `${anomalyColors[a.type]}15`,
                  color: anomalyColors[a.type],
                }}
              >
                <span>{anomalyIcons[a.type]}</span>
                <span className="font-medium">[{anomalyTypeLabel(a.type)}]</span>
                <span>{a.message}</span>
                <span className="ml-1 text-[10px] opacity-60">
                  {new Date(a.createdAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Prop Borrow List */}
      <div className="rounded-xl bg-[#1e1e32] p-4">
        <div className="mb-4 flex items-center gap-3">
          <input
            type="text"
            placeholder="搜索道具名称、编号或借用人..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-lg border border-gray-700 bg-[#0f0f1a] px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-[#d4a843]"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as BorrowStatus | 'all')}
            className="rounded-lg border border-gray-700 bg-[#0f0f1a] px-3 py-2 text-sm text-white outline-none focus:border-[#d4a843]"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-left text-xs text-gray-400">
                <th className="px-3 py-2">道具名称</th>
                <th className="px-3 py-2">道具编号</th>
                <th className="px-3 py-2">场次</th>
                <th className="px-3 py-2">借用人</th>
                <th className="px-3 py-2">借出时间</th>
                <th className="px-3 py-2">预计返库</th>
                <th className="px-3 py-2">实际返库</th>
                <th className="px-3 py-2">状态</th>
                <th className="px-3 py-2">录入类型</th>
              </tr>
            </thead>
            <tbody>
              {visibleRecords.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                    暂无数据
                  </td>
                </tr>
              )}
              {visibleRecords.map((r) => {
                const prop = props.find((p) => p.id === r.propId)
                const hasAnomaly = anomalyRecordIds.has(r.id)
                return (
                  <tr
                    key={r.id}
                    className={`border-b border-gray-800 transition-colors hover:bg-white/5 ${
                      hasAnomaly ? 'border-l-4 border-l-red-500' : ''
                    }`}
                  >
                    <td className="px-3 py-2.5 font-medium">
                      {prop?.name || r.propId}
                      {r.isSupplemented && (
                        <span className="ml-1.5 inline-flex items-center justify-center rounded bg-[#d4a843]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#d4a843]">
                          补
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400">{prop?.code || ''}</td>
                    <td className="px-3 py-2.5">{r.sceneNumber}</td>
                    <td className="px-3 py-2.5">{r.borrower}</td>
                    <td className="px-3 py-2.5 text-gray-400">
                      {r.borrowTime ? new Date(r.borrowTime).toLocaleString() : ''}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400">
                      {r.expectedReturnTime ? new Date(r.expectedReturnTime).toLocaleString() : ''}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400">
                      {r.actualReturnTime ? new Date(r.actualReturnTime).toLocaleString() : ''}
                    </td>
                    <td className="px-3 py-2.5">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-3 py-2.5 text-gray-400">{entryTypeLabel(r.entryType)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
