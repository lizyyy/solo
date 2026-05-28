import { cn } from '@/lib/utils'
import { useStore } from '@/store/useStore'

export default function PortfolioWeights() {
  const bonds = useStore(s => s.bonds)
  const positions = useStore(s => s.positions)
  const setWeight = useStore(s => s.setWeight)
  const getTotalWeight = useStore(s => s.getTotalWeight)

  const totalWeight = getTotalWeight()
  const isOverflow = totalWeight > 100

  return (
    <div className={cn('glass-panel rounded-lg p-4', isOverflow && 'animate-shake')}>
      <h3 className="text-sm font-medium text-white/80 mb-4">组合权重配置</h3>

      <div className="space-y-4">
        {bonds.map(bond => {
          const pos = positions.find(p => p.bondId === bond.id)
          const weight = pos?.weight ?? 0

          return (
            <div key={bond.id}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-white/60">{bond.name}</span>
                <span className="text-xs font-mono text-gold-400">{weight.toFixed(1)}%</span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.5}
                  value={weight}
                  onChange={e => setWeight(bond.id, Number(e.target.value))}
                  className="flex-1 h-1.5 appearance-none rounded-full bg-white/10
                    [&::-webkit-slider-thumb]:appearance-none
                    [&::-webkit-slider-thumb]:w-3.5
                    [&::-webkit-slider-thumb]:h-3.5
                    [&::-webkit-slider-thumb]:rounded-full
                    [&::-webkit-slider-thumb]:bg-gold-500
                    [&::-webkit-slider-thumb]:cursor-pointer
                    [&::-webkit-slider-thumb]:shadow-[0_0_6px_rgba(212,168,67,0.4)]"
                />
                <span className="w-12 text-right font-mono text-xs text-white/50">
                  {weight.toFixed(1)}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-5 pt-4 border-t border-white/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-white/40">总权重</span>
          <span className={cn(
            'text-lg font-mono font-bold',
            isOverflow ? 'text-red-500' : 'text-gold-400'
          )}>
            {totalWeight.toFixed(1)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              isOverflow ? 'bg-red-500' : 'bg-gold-500'
            )}
            style={{ width: `${Math.min(totalWeight, 100)}%` }}
          />
        </div>
        {isOverflow && (
          <p className="text-[10px] text-red-400 mt-1.5 font-mono">
            ⚠ 权重总和超过 100%
          </p>
        )}
      </div>
    </div>
  )
}
