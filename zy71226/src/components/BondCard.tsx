import { cn } from '@/lib/utils'
import type { Bond } from '@/types'

interface BondCardProps {
  bond: Bond
  price: number
  duration: number
  isSelected: boolean
  onClick: () => void
}

function getDurationColor(d: number): string {
  if (d <= 3) return '#22c55e'
  if (d <= 7) return '#d4a843'
  return '#ef4444'
}

function getDurationLabel(d: number): string {
  if (d <= 3) return '短久期'
  if (d <= 7) return '中久期'
  return '长久期'
}

export default function BondCard({ bond, price, duration, isSelected, onClick }: BondCardProps) {
  const barColor = getDurationColor(duration)
  const maxDuration = 30
  const barWidth = Math.min((duration / maxDuration) * 100, 100)

  return (
    <div
      onClick={onClick}
      className={cn(
        'glass-panel rounded-lg p-4 cursor-pointer transition-all duration-200',
        'hover:border-gold-500/40',
        isSelected && 'ring-2 ring-gold-500 shadow-[0_0_16px_rgba(212,168,67,0.35)]'
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-medium text-white/90">{bond.name}</h3>
        <span className={cn(
          'text-[10px] px-1.5 py-0.5 rounded font-mono',
          duration <= 3 ? 'bg-green-500/15 text-green-400' :
          duration <= 7 ? 'bg-gold-500/15 text-gold-400' :
          'bg-red-500/15 text-red-400'
        )}>
          {getDurationLabel(duration)}
        </span>
      </div>

      <div className="text-2xl font-mono font-bold text-white mb-3">
        {price.toFixed(2)}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mb-3">
        <div className="flex justify-between">
          <span className="text-white/40">票息</span>
          <span className="font-mono text-gold-400">{(bond.coupon * 100).toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/40">期限</span>
          <span className="font-mono text-white/80">{bond.maturity}年</span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-white/40">久期</span>
          <span className="font-mono" style={{ color: barColor }}>
            {duration.toFixed(2)}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${barWidth}%`, backgroundColor: barColor }}
          />
        </div>
      </div>
    </div>
  )
}
