import { useEffect, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import { useStore } from '@/store'
import AuditTimeline from '@/components/AuditTimeline'

export default function AuditLogPage() {
  const { auditLogs, settlements, fetchAuditLogs, fetchSettlements, rerunSettlement, loading } = useStore()
  const [selectedSettlement, setSelectedSettlement] = useState<string>('')

  useEffect(() => {
    fetchSettlements()
    fetchAuditLogs()
  }, [fetchSettlements, fetchAuditLogs])

  const handleFilterChange = (settlementId: string) => {
    setSelectedSettlement(settlementId)
    fetchAuditLogs(settlementId || undefined)
  }

  const handleRerun = async (settlementId: string) => {
    await rerunSettlement(settlementId)
    fetchAuditLogs(selectedSettlement || undefined)
  }

  const importLogs = auditLogs.filter((l) => l.action === 'import' || l.action === 'rerun')
  const importSettlementIds = [...new Set(importLogs.map((l) => l.settlementId))]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif font-semibold text-ledger-text">复盘记录</h1>
        <div className="flex items-center gap-3">
          <select
            value={selectedSettlement}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="rounded-lg border border-ledger-border px-3 py-1.5 text-sm text-ledger-text focus:outline-none focus:ring-2 focus:ring-ledger-amber/30"
          >
            <option value="">全部结算单</option>
            {settlements.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      {importSettlementIds.length > 0 && (
        <div className="bg-white rounded-xl border border-ledger-border p-4 shadow-sm">
          <h3 className="text-sm font-medium text-ledger-text mb-3">可重跑的导入记录</h3>
          <div className="space-y-2">
            {importSettlementIds.map((sid) => {
              const settlement = settlements.find((s) => s.id === sid)
              const log = importLogs.find((l) => l.settlementId === sid)
              return (
                <div
                  key={sid}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-ledger-bg/50"
                >
                  <div>
                    <span className="text-sm text-ledger-text">{settlement?.name || sid}</span>
                    {log && (
                      <span className="text-xs text-ledger-muted ml-2 font-mono">
                        {new Date(log.createdAt).toLocaleString('zh-CN')}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRerun(sid)}
                    disabled={loading}
                    className="flex items-center gap-1.5 rounded-lg bg-purple-50 text-purple-600 px-3 py-1.5 text-xs font-medium hover:bg-purple-100 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="w-3 h-3" />
                    重跑
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-ledger-border p-5 shadow-sm">
        <AuditTimeline logs={auditLogs} />
      </div>
    </div>
  )
}
