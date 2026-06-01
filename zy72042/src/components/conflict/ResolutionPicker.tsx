import { GitBranch, Check } from 'lucide-react'
import type { ConflictRecord, ConflictResolution } from '@/types'

interface ResolutionPickerProps {
  conflict: ConflictRecord
  onResolve: (resolution: ConflictResolution) => void
}

const RESOLUTION_OPTIONS: { value: ConflictResolution; label: string; description: string }[] = [
  { value: 'accepted_notebook', label: '采纳错题本数据', description: '以教师错题本记录为准' },
  { value: 'accepted_import', label: '采纳导入数据', description: '以系统导入数据为准' },
  { value: 'manual', label: '手动处理', description: '自行核实后决定' },
  { value: 'pending', label: '暂不处理', description: '标记为待处理，稍后决定' },
]

export default function ResolutionPicker({ conflict, onResolve }: ResolutionPickerProps) {
  const isResolved = conflict.resolution !== 'pending'

  return (
    <div className="card-cafe flex flex-col gap-2">
      <div className="flex items-center gap-2 text-cafe-brown font-medium text-sm">
        <GitBranch className="w-4 h-4" />
        <span>选择处理方案</span>
      </div>

      <div className="flex flex-col gap-2">
        {RESOLUTION_OPTIONS.map((opt) => {
          const isSelected = conflict.resolution === opt.value
          const isDisabled = isResolved && !isSelected

          return (
            <button
              key={opt.value}
              className="btn-secondary text-left flex items-center justify-between gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => onResolve(opt.value)}
              disabled={isDisabled}
            >
              <div className="flex flex-col">
                <span className="text-sm font-medium text-cafe-brown">{opt.label}</span>
                <span className="text-xs text-cafe-brown/50">{opt.description}</span>
              </div>
              {isSelected && (
                <Check className="w-4 h-4 text-green-600 shrink-0" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
