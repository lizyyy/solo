import { useAppStore } from '@/stores/appStore'
import { useEffect } from 'react'
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function MarketPanel() {
  const { snapshots, loading } = useAppStore(s => s.market)
  const fetchMarket = useAppStore(s => s.fetchMarket)
  const toggleMarketPanel = useAppStore(s => s.toggleMarketPanel)

  useEffect(() => {
    fetchMarket()
  }, [fetchMarket])

  const formatTime = (t: string) => {
    if (!t) return '--'
    const d = new Date(t)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <aside className="w-72 bg-bg-secondary border-l border-border flex flex-col shrink-0">
      <div className="flex items-center justify-between h-topbar px-4 border-b border-border">
        <span className="text-sm font-medium text-text-primary">行情快照</span>
        <button onClick={toggleMarketPanel} className="p-1 rounded hover:bg-bg-card text-text-secondary">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="text-center text-text-secondary text-sm py-8">加载中...</div>
        ) : snapshots.length === 0 ? (
          <div className="text-center text-text-secondary text-sm py-8">暂无行情数据</div>
        ) : (
          snapshots.map(s => (
            <div key={s.id} className="bg-bg-card rounded-lg p-3 border border-border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-text-primary">
                  {s.contract?.code || '--'}
                </span>
                <span
                  className={`flex items-center gap-0.5 text-xs font-mono-num font-medium ${
                    s.change_pct > 0
                      ? 'text-safe'
                      : s.change_pct < 0
                        ? 'text-force-liq'
                        : 'text-text-secondary'
                  }`}
                >
                  {s.change_pct > 0 ? <TrendingUp size={12} /> : s.change_pct < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                  {s.change_pct > 0 ? '+' : ''}{s.change_pct.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-mono-num text-base text-text-primary">
                  {s.last_price.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-text-secondary">
                  {formatTime(s.snapshot_time)}
                </span>
              </div>
              {s.contract?.name && (
                <div className="text-xs text-text-secondary mt-1">{s.contract.name}</div>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
