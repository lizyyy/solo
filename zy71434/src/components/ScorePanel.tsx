import { Star, Flame, RotateCcw } from 'lucide-react'

interface ScorePanelProps {
  score: number
  combo: number
  maxCombo: number
  round: number
  totalRounds: number
}

export default function ScorePanel({ score, combo, maxCombo, round, totalRounds }: ScorePanelProps) {
  return (
    <div className="card-magic absolute top-4 right-4 min-w-[180px]">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-primary-orange" />
          <span className="font-display text-2xl text-primary-orange">{score}</span>
        </div>
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-danger" />
          <span className="font-display text-lg text-danger">{combo}x</span>
          <span className="font-body text-xs text-white/40">max {maxCombo}</span>
        </div>
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-primary-purple" />
          <span className="font-body text-sm text-white/70">
            {round} / {totalRounds}
          </span>
        </div>
        <div className="w-full h-1.5 bg-bg-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-primary-purple rounded-full transition-all duration-300"
            style={{ width: `${(round / totalRounds) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
