import { AlertTriangle, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react'
import { useTrailStore } from '@/store/useStore'
import type { ConflictResolution } from '@/types'

export default function ConflictBanner() {
  const conflicts = useTrailStore((state) => state.conflicts)
  const getUnresolvedConflicts = useTrailStore((state) => state.getUnresolvedConflicts)
  const conflictBannerExpanded = useTrailStore((state) => state.conflictBannerExpanded)
  const setConflictBannerExpanded = useTrailStore((state) => state.setConflictBannerExpanded)
  const resolveConflict = useTrailStore((state) => state.resolveConflict)
  const getPointById = useTrailStore((state) => state.getPointById)

  const unresolved = getUnresolvedConflicts()

  if (unresolved.length === 0) return null

  const resolutionLabels: Record<ConflictResolution, string> = {
    use_feedback: '已采纳居民反馈',
    use_import: '已采纳导入数据',
    mark_for_review: '已标记待核实',
  }

  return (
    <div className="mb-2">
      <button
        onClick={() => setConflictBannerExpanded(!conflictBannerExpanded)}
        className="w-full bg-[#ff6b35] text-white rounded-lg px-4 py-2.5 flex items-center justify-between shadow-sm"
      >
        <span className="flex items-center gap-2">
          <AlertTriangle size={18} />
          <span className="font-medium">
            {unresolved.length} 个未解决冲突
          </span>
        </span>
        {conflictBannerExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>

      {conflictBannerExpanded && (
        <div className="bg-white rounded-lg mt-1 shadow-sm overflow-hidden">
          {conflicts.map((conflict) => {
            const point = getPointById(conflict.pointId)
            const isResolved = !!conflict.resolution

            return (
              <div
                key={conflict.id}
                className="border-b border-gray-100 last:border-b-0 px-4 py-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  {isResolved ? (
                    <CheckCircle size={14} className="text-[#4ecdc4] shrink-0" />
                  ) : (
                    <AlertTriangle size={14} className="text-[#ff6b35] shrink-0" />
                  )}
                  <span className="font-medium text-sm text-[#1a535c]">
                    {point?.name || '未知点位'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-2 text-sm">
                  <div className="bg-gray-50 rounded px-3 py-2">
                    <div className="text-xs text-gray-400 mb-1">导入数据</div>
                    <div className="text-gray-700">{conflict.importDataSummary}</div>
                  </div>
                  <div className="bg-gray-50 rounded px-3 py-2">
                    <div className="text-xs text-gray-400 mb-1">居民反馈</div>
                    <div className="text-gray-700">{conflict.feedbackSummary}</div>
                  </div>
                </div>

                {isResolved ? (
                  <div className="text-xs text-[#4ecdc4] font-medium">
                    {resolutionLabels[conflict.resolution!]}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => resolveConflict(conflict.id, 'use_feedback')}
                      className="text-xs px-3 py-1.5 rounded bg-[#1a535c] text-white hover:opacity-90 transition-opacity"
                    >
                      采纳居民反馈
                    </button>
                    <button
                      onClick={() => resolveConflict(conflict.id, 'use_import')}
                      className="text-xs px-3 py-1.5 rounded bg-[#4ecdc4] text-white hover:opacity-90 transition-opacity"
                    >
                      采纳导入数据
                    </button>
                    <button
                      onClick={() => resolveConflict(conflict.id, 'mark_for_review')}
                      className="text-xs px-3 py-1.5 rounded bg-[#ff6b35] text-white hover:opacity-90 transition-opacity"
                    >
                      标记待核实
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
