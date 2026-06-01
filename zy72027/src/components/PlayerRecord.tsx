import type { PlayerChoice } from '@/types'
import { formatTimestamp } from '@/utils/timeUtils'

const ACTION_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  hit: { bg: 'bg-emerald-900/40', text: 'text-emerald-400', label: '命中' },
  miss: { bg: 'bg-gray-800/60', text: 'text-gray-400', label: '错过' },
  wrong: { bg: 'bg-red-900/40', text: 'text-red-400', label: '错误' },
}

interface Props {
  choices: PlayerChoice[]
}

export default function PlayerRecord({ choices }: Props) {
  if (choices.length === 0) {
    return (
      <div className="bg-[#12163a]/80 rounded-xl border border-purple-900/40 p-4">
        <p className="text-sm text-gray-500 text-center">暂无玩家记录</p>
      </div>
    )
  }

  const totalScore = choices.reduce((sum, c) => sum + c.score, 0)
  const hits = choices.filter(c => c.action === 'hit').length
  const misses = choices.filter(c => c.action === 'miss').length
  const wrongs = choices.filter(c => c.action === 'wrong').length

  return (
    <div className="bg-[#12163a]/80 rounded-xl border border-purple-900/40 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">玩家记录</h3>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-emerald-400">命中 {hits}</span>
          <span className="text-gray-500">错过 {misses}</span>
          <span className="text-red-400">错误 {wrongs}</span>
          <span className="text-purple-300 font-medium">总分 {totalScore}</span>
        </div>
      </div>

      <div className="max-h-[200px] overflow-y-auto space-y-1 pr-1 scrollbar-thin">
        {choices.slice().reverse().map((choice, i) => {
          const style = ACTION_STYLES[choice.action]
          return (
            <div
              key={`${choice.noteId}-${i}`}
              className={`flex items-center justify-between px-3 py-1.5 rounded-lg ${style.bg} text-xs`}
            >
              <div className="flex items-center gap-3">
                <span className="text-gray-500">R{choice.roundIndex}</span>
                <span className={`${style.text} font-medium`}>{style.label}</span>
                <span className="text-gray-600">{choice.noteId}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-mono ${choice.score > 0 ? 'text-emerald-400' : choice.score < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                  {choice.score > 0 ? '+' : ''}{choice.score}
                </span>
                <span className="text-gray-600">{formatTimestamp(choice.timestamp).slice(11)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
