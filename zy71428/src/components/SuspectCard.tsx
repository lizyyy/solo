import { motion } from 'framer-motion'
import type { Suspect } from '../types'

interface SuspectCardProps {
  suspect: Suspect
  isRevealed: boolean
  isHighest: boolean
}

export default function SuspectCard({ suspect, isRevealed, isHighest }: SuspectCardProps) {
  const pct = Math.round(suspect.currentProbability * 100)
  const priorPct = Math.round(suspect.priorProbability * 100)

  const barColor =
    pct > 50 ? 'bg-suspect-high' :
    pct > 25 ? 'bg-suspect-mid' :
    'bg-suspect-low'

  const glowClass = pct > 40 ? 'card-glow-high' : ''
  const guiltyReveal = isRevealed && suspect.isGuilty

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`card-float relative rounded-xl border transition-all duration-300 ${glowClass} ${
        guiltyReveal
          ? 'border-gold bg-gradient-to-br from-gold/20 to-purple-900/80 ring-2 ring-gold/50'
          : isHighest
          ? 'border-suspect-high/50 bg-gradient-to-br from-suspect-high/10 to-card-bg'
          : 'border-card-border bg-card-bg'
      }`}
    >
      {guiltyReveal && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gold text-purple-950 text-xs font-bold px-3 py-1 rounded-full z-10">
          👑 真凶
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-3xl">{suspect.avatar}</span>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-bold text-base truncate text-purple-50">
              {suspect.name}
            </h3>
            <p className="text-xs text-purple-300 mt-0.5 line-clamp-1">
              {suspect.description}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-purple-300">嫌疑概率</span>
            <div className="flex items-center gap-2">
              <span className="text-purple-400 text-xs line-through">{priorPct}%</span>
              <span className={`font-mono font-bold text-lg number-roll ${
                pct > 50 ? 'text-suspect-high' : pct > 25 ? 'text-suspect-mid' : 'text-suspect-low'
              }`}>
                {pct}%
              </span>
            </div>
          </div>

          <div className="w-full h-2.5 bg-purple-900/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full probability-bar ${barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}
