import type { PlayerChoice } from '@/types'

interface Props {
  choices: PlayerChoice[]
  currentRound: number
  onJumpToRound: (round: number) => void
}

const ACTION_COLORS: Record<string, string> = {
  hit: 'bg-emerald-500',
  miss: 'bg-gray-600',
  wrong: 'bg-red-500',
}

export default function RoundTimeline({ choices, currentRound, onJumpToRound }: Props) {
  const roundMap = new Map<number, PlayerChoice[]>()
  for (const c of choices) {
    const arr = roundMap.get(c.roundIndex) || []
    arr.push(c)
    roundMap.set(c.roundIndex, arr)
  }

  const maxRound = Math.max(...choices.map(c => c.roundIndex), 1)

  return (
    <div className="bg-[#12163a]/80 rounded-xl border border-purple-900/40 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-300">回合时间线</h3>
      <div className="relative">
        <div className="flex items-center gap-1 overflow-x-auto pb-2 px-1">
          {Array.from({ length: maxRound }, (_, i) => i + 1).map(round => {
            const roundChoices = roundMap.get(round) || []
            const primaryAction = roundChoices.length > 0
              ? roundChoices.reduce((best, c) => {
                  const priority = { hit: 3, wrong: 2, miss: 1 }
                  return priority[c.action] > priority[best.action] ? c : best
                }, roundChoices[0]).action
              : 'miss'
            const isCurrent = round === currentRound
            const color = ACTION_COLORS[primaryAction]

            return (
              <button
                key={round}
                onClick={() => onJumpToRound(round)}
                className={`flex-shrink-0 w-10 h-10 rounded-lg border transition-all duration-200 flex flex-col items-center justify-center ${
                  isCurrent
                    ? 'border-purple-400 bg-purple-900/40 shadow-[0_0_8px_rgba(139,92,246,0.4)]'
                    : 'border-gray-700/40 bg-gray-800/30 hover:border-purple-700/40 hover:bg-purple-900/20'
                }`}
              >
                <span className="text-[10px] text-gray-500">R</span>
                <span className={`text-xs font-bold ${isCurrent ? 'text-purple-300' : 'text-gray-400'}`}>{round}</span>
                <div className={`w-1.5 h-1.5 rounded-full ${color} mt-0.5`} />
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex items-center gap-4 text-[10px] text-gray-500">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>命中</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-red-500" />
          <span>错误</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-gray-600" />
          <span>错过</span>
        </div>
      </div>
    </div>
  )
}
