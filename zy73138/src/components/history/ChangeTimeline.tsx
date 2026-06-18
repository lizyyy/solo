import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { ChangeRecord } from '@/types'
import { formatDateTime } from '@/utils'

interface ChangeTimelineProps {
  changes: ChangeRecord[]
  recordId?: string
}

export default function ChangeTimeline({ changes, recordId }: ChangeTimelineProps) {
  const filtered = recordId
    ? changes.filter((c) => c.recordId === recordId)
    : changes

  const sorted = [...filtered].sort(
    (a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime()
  )

  if (sorted.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-foam/50 font-sans">
        暂无变更记录
      </div>
    )
  }

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="flex items-start min-w-max gap-0">
        {sorted.map((change, idx) => (
          <div key={change.id} className="flex items-start">
            <div className="flex flex-col items-center w-56 flex-shrink-0">
              <Link
                to={`/record/${change.recordId}`}
                className="text-tide hover:text-tide-light font-mono text-sm mb-2 transition-colors"
              >
                {change.recordId}
              </Link>

              <div className="w-4 h-4 rounded-full bg-tide flex-shrink-0 ring-4 ring-ocean-800 z-10" />

              <div className="mt-3 w-48 rounded-lg bg-ocean-800 border border-ocean-700 p-3">
                <div className="text-sand text-xs font-sans mb-2 tracking-wide">
                  {change.field}
                </div>

                <div className="flex items-center gap-1.5 font-mono text-sm mb-2">
                  <span className="line-through text-rust">{change.oldValue}</span>
                  <ArrowRight className="w-3 h-3 text-foam/40 flex-shrink-0" />
                  <span className="text-tide">{change.newValue}</span>
                </div>

                <div className="text-foam/60 text-xs font-sans mb-1">
                  {change.changedBy}
                </div>

                <div className="text-foam/40 text-xs font-sans mb-2">
                  {formatDateTime(change.changedAt)}
                </div>

                <div className="text-foam/50 text-xs font-sans border-t border-ocean-700 pt-2 leading-relaxed">
                  {change.reason}
                </div>
              </div>
            </div>

            {idx < sorted.length - 1 && (
              <div className="h-0.5 bg-ocean-700 mt-[30px] w-8 flex-shrink-0 self-start" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
