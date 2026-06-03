import { useEffect } from 'react'
import { RefreshCw, Users, ShieldAlert } from 'lucide-react'
import { useStore } from '@/store'
import SummaryCard from '@/components/SummaryCard'

export default function SummaryPage() {
  const { summaries, fetchSummaries, refreshSummaries, loading } = useStore()

  useEffect(() => {
    fetchSummaries()
  }, [fetchSummaries])

  const fundAccountant = summaries.filter((s) => s.responsibleRole === 'fund_accountant')
  const riskControl = summaries.filter((s) => s.responsibleRole === 'risk_control')

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-serif font-semibold text-ledger-text">负责人摘要</h1>
          <p className="text-sm text-ledger-muted mt-1">
            共 {summaries.length} 条摘要待处理
          </p>
        </div>
        <button
          onClick={refreshSummaries}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-ledger-amber text-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-ledger-amber/90 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新摘要
        </button>
      </div>

      <div className="space-y-8">
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-ledger-amber" />
            <h2 className="text-lg font-serif font-semibold text-ledger-text">需要基金会计处理</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-ledger-amber-light text-ledger-amber">
              {fundAccountant.length}
            </span>
          </div>
          {fundAccountant.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {fundAccountant.map((s) => (
                <SummaryCard key={s.id} summary={s} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-ledger-muted text-sm bg-white rounded-xl border border-ledger-border">
              暂无需要基金会计处理的条目
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="w-4 h-4 text-ledger-red" />
            <h2 className="text-lg font-serif font-semibold text-ledger-text">需要风控同事复核</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-ledger-red-light text-ledger-red">
              {riskControl.length}
            </span>
          </div>
          {riskControl.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {riskControl.map((s) => (
                <SummaryCard key={s.id} summary={s} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-ledger-muted text-sm bg-white rounded-xl border border-ledger-border">
              暂无需要风控复核的条目
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
