import type { HistoryEntry } from '@/types'
import { Import, ClipboardCheck, Calculator, CheckCircle, Edit, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACTION_ICONS: Record<string, React.ElementType> = {
  import: Import,
  supplement: ClipboardCheck,
  calculate: Calculator,
  confirm: CheckCircle,
  correct: Edit,
  rerun: RefreshCw,
}

const ACTION_COLORS: Record<string, string> = {
  import: 'text-slate-500 bg-slate-100',
  supplement: 'text-sky-600 bg-sky-50',
  calculate: 'text-indigo-600 bg-indigo-50',
  confirm: 'text-emerald-600 bg-emerald-50',
  correct: 'text-purple-600 bg-purple-50',
  rerun: 'text-orange-600 bg-orange-50',
}

interface HistoryTimelineProps {
  entries: HistoryEntry[]
  compact?: boolean
}

export default function HistoryTimeline({ entries, compact }: HistoryTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-400">
        暂无操作记录
      </div>
    )
  }

  return (
    <div className={cn('space-y-0', compact && 'space-y-0')}>
      {entries.map((entry, idx) => {
        const Icon = ACTION_ICONS[entry.action] ?? Import
        const colorClass = ACTION_COLORS[entry.action] ?? 'text-slate-500 bg-slate-100'
        const isLast = idx === entries.length - 1

        return (
          <div key={entry.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={cn('flex h-7 w-7 items-center justify-center rounded-full', colorClass)}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              {!isLast && <div className="w-px flex-1 bg-slate-200" />}
            </div>
            <div className={cn('pb-4', isLast && 'pb-0')}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-700">{entry.operator}</span>
                <span className="text-xs text-slate-400">{entry.timestamp}</span>
              </div>
              <p className={cn('text-xs text-slate-500 leading-relaxed', compact && 'line-clamp-2')}>
                {entry.detail}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
