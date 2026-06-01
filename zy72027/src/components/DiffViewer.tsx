import { ArrowRight } from 'lucide-react'
import type { SupplementaryNote, RoundStat } from '@/types'

interface Props {
  roundStats: RoundStat[]
  notes: SupplementaryNote[]
}

export default function DiffViewer({ roundStats, notes }: Props) {
  const supplementaryNotes = notes.filter(n => n.isSupplementary)
  if (supplementaryNotes.length === 0) {
    return (
      <div className="bg-[#12163a]/80 rounded-xl border border-purple-900/40 p-4">
        <p className="text-xs text-gray-500 text-center">暂无补录差异</p>
      </div>
    )
  }

  const statMap = new Map(roundStats.map(s => [s.roundIndex, s]))

  return (
    <div className="bg-[#12163a]/80 rounded-xl border border-amber-800/30 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-amber-300">补录差异对比</h3>
      <div className="space-y-2">
        {supplementaryNotes.map(note => {
          const stat = statMap.get(note.roundIndex)
          const currentScore = stat?.score ?? 0
          const originalScore = note.originalScoreSnapshot
          const diff = currentScore - originalScore

          return (
            <div
              key={note.id}
              className="bg-[#1a1f4a]/40 rounded-lg p-3 border border-amber-900/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-amber-300">第{note.roundIndex}回合</span>
                <span className="text-[10px] text-gray-600">{note.author}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="bg-red-900/30 px-3 py-1 rounded border border-red-800/30">
                  <span className="text-red-400 font-mono">{originalScore}</span>
                  <span className="text-[10px] text-gray-500 ml-1">补录前</span>
                </div>
                <ArrowRight size={14} className="text-gray-600" />
                <div className="bg-emerald-900/30 px-3 py-1 rounded border border-emerald-800/30">
                  <span className="text-emerald-400 font-mono">{currentScore}</span>
                  <span className="text-[10px] text-gray-500 ml-1">补录后</span>
                </div>
                <span className={`text-xs font-medium ${diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                  {diff > 0 ? '+' : ''}{diff}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-2">{note.content}</p>
              <p className="text-[10px] text-gray-600 mt-1">
                补录说明：该备注为事后补录，原始得分快照为 {originalScore} 分，
                补录时该回合得分为 {currentScore} 分。
                {diff !== 0 && `差异 ${diff > 0 ? '+' : ''}${diff} 分可能来自后续操作。`}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
