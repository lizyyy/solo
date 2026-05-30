import { Lock, Unlock, Ship } from 'lucide-react'
import { useGameStore } from '../store/gameStore'
import { CABIN_TIER_LABELS } from '../engine/types'

export function CabinSelector() {
  const { cabinSlots, lockCabin, containers } = useGameStore()

  const totalLoaded = containers.filter(c => c.status === 'loaded').length
  const lockedCapacity = cabinSlots
    .filter(s => s.locked)
    .reduce((sum, s) => sum + s.capacity, 0)
  const isOverbooked = totalLoaded > lockedCapacity

  return (
    <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-amber-400 font-serif text-lg flex items-center gap-2">
          <Ship size={20} />
          舱位选择
        </h3>
        {isOverbooked && (
          <span className="text-xs bg-red-900 text-red-300 px-2 py-1 rounded animate-pulse">
            ⚠️ 舱位超订！
          </span>
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {cabinSlots.map(slot => (
          <div
            key={slot.id}
            onClick={() => !slot.locked && lockCabin(slot.id)}
            className={`
              p-3 rounded-lg border-2 transition-all duration-200
              ${slot.locked
                ? 'bg-slate-700 border-slate-500 opacity-60 cursor-not-allowed'
                : 'bg-slate-700/50 border-slate-600 hover:border-amber-500 cursor-pointer hover:bg-slate-600/50'
              }
            `}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-white">
                {CABIN_TIER_LABELS[slot.tier]}
              </span>
              {slot.locked ? (
                <Lock size={16} className="text-amber-400" />
              ) : (
                <Unlock size={16} className="text-slate-400" />
              )}
            </div>
            <div className="text-sm text-slate-300 mb-1">
              ¥{slot.costPerContainer.toLocaleString()} / 柜
            </div>
            <div className="text-xs text-slate-400">
              容量: {slot.capacity} 柜
            </div>
            {slot.locked && (
              <div className="text-xs text-amber-400 mt-1">已锁定</div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 pt-3 border-t border-slate-700">
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">已装载货柜</span>
          <span className={isOverbooked ? 'text-red-400 font-bold' : 'text-white'}>
            {totalLoaded} / {lockedCapacity || '未锁定'}
          </span>
        </div>
      </div>
    </div>
  )
}
