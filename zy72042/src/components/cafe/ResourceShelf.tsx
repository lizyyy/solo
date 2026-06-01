import { Package, Coins } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import { FUND_ASSETS } from '@/data/funds'
import { LEVELS } from '@/data/levels'
import FundCard from './FundCard'

export default function ResourceShelf() {
  const session = useGameStore((s) => s.session)

  if (!session) {
    return (
      <div className="card-cafe w-64 min-w-64 flex items-center justify-center">
        <p className="text-cafe-brown/40 text-sm">请先选择关卡</p>
      </div>
    )
  }

  const level = LEVELS.find((l) => l.id === session.levelId)
  if (!level) return null

  const holdingIds = new Set(session.holdings.map((h) => h.fundId))
  const availableFunds = FUND_ASSETS.filter(
    (f) => level.availableFundIds.includes(f.id) && !holdingIds.has(f.id)
  )

  return (
    <div className="card-cafe w-64 min-w-64 flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-8rem)]">
      <div className="flex items-center gap-2">
        <Package className="w-5 h-5 text-cafe-brown" />
        <h2 className="font-serif text-lg font-bold text-cafe-brown">资源架</h2>
      </div>

      <div className="flex items-center gap-1.5 text-sm text-cafe-brown/70">
        <Coins className="w-4 h-4" />
        <span>剩余资源: {session.remainingResources.toFixed(0)}</span>
      </div>

      <div className="flex flex-col gap-2">
        {availableFunds.map((fund) => (
          <FundCard key={fund.id} fund={fund} />
        ))}
        {availableFunds.length === 0 && (
          <p className="text-xs text-center text-cafe-brown/40 py-4">
            所有基金已加入操作台
          </p>
        )}
      </div>
    </div>
  )
}
