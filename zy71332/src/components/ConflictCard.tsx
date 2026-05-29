import type { ConflictResult } from '../../shared/types'

interface Props {
  conflict: ConflictResult
  onResolve: () => void
}

export default function ConflictCard({ conflict, onResolve }: Props) {
  const isResolved = conflict.status === 'resolved'

  return (
    <div className="bg-brand-800 border border-red-500/30 rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
            <span className="text-sm font-medium text-red-400">时段冲突</span>
            {isResolved && <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">已处理</span>}
          </div>
          <p className="text-white text-sm">{conflict.description}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-brand-300">
            <span>琴房: <span className="text-brand-100">{conflict.room}</span></span>
            <span>日期: <span className="mono text-brand-100">{conflict.date}</span></span>
            <span>时段: <span className="mono text-brand-100">{conflict.timeSlot}</span></span>
          </div>
          <p className="text-xs text-brand-400 mt-1">涉及预约 ID: {conflict.reservationIds.join(', ')}</p>
        </div>
        {!isResolved && (
          <button
            onClick={onResolve}
            className="shrink-0 ml-3 text-xs px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded border border-green-500/30 transition-colors"
          >
            标记已处理
          </button>
        )}
      </div>
    </div>
  )
}
