import type { LevelParams } from '@/types'
import { Zap } from 'lucide-react'

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: 'border-emerald-500/40 text-emerald-400',
  medium: 'border-amber-500/40 text-amber-400',
  hard: 'border-red-500/40 text-red-400',
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

interface Props {
  levels: LevelParams[]
  selectedId: string | null
  onSelect: (level: LevelParams) => void
  disabled?: boolean
}

export default function LevelSelector({ levels, selectedId, onSelect, disabled }: Props) {
  return (
    <div className="bg-[#12163a]/80 rounded-xl border border-purple-900/40 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
        <Zap size={14} className="text-purple-400" />
        选择关卡
      </h3>
      <div className="space-y-2">
        {levels.map(level => {
          const isSelected = selectedId === level.id
          const diffStyle = DIFFICULTY_STYLES[level.difficulty]
          return (
            <button
              key={level.id}
              onClick={() => onSelect(level)}
              disabled={disabled}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all duration-200 ${
                isSelected
                  ? 'border-purple-500/60 bg-purple-900/30 shadow-[0_0_12px_rgba(139,92,246,0.2)]'
                  : 'border-gray-700/40 bg-gray-800/20 hover:border-purple-700/40 hover:bg-purple-900/10'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-200">{level.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded border ${diffStyle}`}>
                  {DIFFICULTY_LABELS[level.difficulty]}
                </span>
              </div>
              <div className="mt-1.5 flex gap-3 text-xs text-gray-500">
                <span>音符: {level.noteTypes.join(', ')}</span>
                <span>速度: ×{level.speedMultiplier}</span>
                <span>总数: {level.noteCount}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
