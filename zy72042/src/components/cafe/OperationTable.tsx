import { useState } from 'react'
import { LayoutGrid, Plus } from 'lucide-react'
import { useGameStore } from '@/stores/gameStore'
import { FUND_ASSETS } from '@/data/funds'
import { LEVELS } from '@/data/levels'
import FundCard from './FundCard'

export default function OperationTable() {
  const session = useGameStore((s) => s.session)
  const addFundToPortfolio = useGameStore((s) => s.addFundToPortfolio)
  const removeFundFromPortfolio = useGameStore((s) => s.removeFundFromPortfolio)
  const adjustRatio = useGameStore((s) => s.adjustRatio)
  const [showAdd, setShowAdd] = useState(false)

  if (!session) return null

  const level = LEVELS.find((l) => l.id === session.levelId)
  if (!level) return null

  const holdingIds = new Set(session.holdings.map((h) => h.fundId))
  const availableToAdd = FUND_ASSETS.filter(
    (f) => level.availableFundIds.includes(f.id) && !holdingIds.has(f.id)
  )

  const totalRatio = session.holdings.reduce((sum, h) => sum + h.ratio, 0)
  const ratioPercent = Math.round(totalRatio * 100)
  const ratioOverflow = totalRatio > 1

  return (
    <div className="card-cafe flex-1 min-w-0 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <LayoutGrid className="w-5 h-5 text-cafe-brown" />
        <h2 className="font-serif text-lg font-bold text-cafe-brown">操作台</h2>
      </div>

      <div className="flex-1 flex flex-col gap-2 overflow-y-auto min-h-0">
        {session.holdings.length === 0 && (
          <div className="flex-1 flex items-center justify-center border-2 border-dashed border-cafe-latte rounded-xl py-12">
            <p className="text-cafe-brown/40 text-sm">从左侧资源架拖入基金</p>
          </div>
        )}

        {session.holdings.map((holding) => {
          const fund = FUND_ASSETS.find((f) => f.id === holding.fundId)
          if (!fund) return null
          return (
            <FundCard
              key={holding.fundId}
              fund={fund}
              inPortfolio
              ratio={holding.ratio}
              onAdjust={(delta) => adjustRatio(holding.fundId, delta)}
              onRemove={() => removeFundFromPortfolio(holding.fundId)}
            />
          )
        })}
      </div>

      <div className="flex flex-col gap-2 pt-2 border-t border-cafe-latte/40">
        <div className="flex items-center justify-between text-sm">
          <span className="text-cafe-brown/70">总配比</span>
          <span className={`font-bold ${ratioOverflow ? 'text-risk-red' : 'text-cafe-brown'}`}>
            {ratioPercent}%
          </span>
        </div>
        <div className="h-2 bg-cafe-latte/30 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(ratioPercent, 100)}%`,
              backgroundColor: ratioOverflow ? '#D32F2F' : ratioPercent >= 90 ? '#388E3C' : '#FBC02D',
            }}
          />
        </div>

        {availableToAdd.length > 0 && (
          <div className="relative">
            <button
              className="btn-secondary w-full flex items-center justify-center gap-1 text-sm py-2"
              onClick={() => setShowAdd(!showAdd)}
            >
              <Plus className="w-4 h-4" />
              添加基金
            </button>
            {showAdd && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-xl shadow-lg border border-cafe-latte/30 overflow-hidden z-10 max-h-48 overflow-y-auto">
                {availableToAdd.map((fund) => (
                  <button
                    key={fund.id}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-cafe-cream transition-colors flex items-center gap-2"
                    onClick={() => {
                      addFundToPortfolio(fund.id, 0.2)
                      setShowAdd(false)
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: fund.color }}
                    />
                    <span className="text-cafe-brown">{fund.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
