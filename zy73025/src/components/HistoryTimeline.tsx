import { Hand, ArrowRight } from 'lucide-react'
import type { HistoryEntry, Conclusion } from '@shared/types'
import StatusBadge from './StatusBadge'
import { cn } from '@/lib/utils'

interface HistoryTimelineProps {
  history: HistoryEntry[]
}

const ACTION_LABEL: Record<HistoryEntry['action'], string> = {
  create: '创建记录',
  review: '复核',
  rejudge: '改判',
  supplement: '补录',
  ack_exception: '确认异常',
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(
    2,
    '0',
  )}`
}

export default function HistoryTimeline({ history }: HistoryTimelineProps) {
  if (history.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/40 py-16 text-center">
        <p className="text-sm text-slate-400">暂无历史记录</p>
        <p className="mt-1 text-xs text-slate-300">系统将自动记录所有操作</p>
      </div>
    )
  }

  return (
    <ol className="relative space-y-4 pl-2 before:absolute before:left-[18px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
      {history.map((h) => {
        const isManual = h.isManual
        const oldConc = h.oldSnapshot.conclusion
        const newConc = h.newSnapshot.conclusion

        return (
          <li
            key={h.id}
            className={cn(
              'group relative pl-10 transition-all',
              'hover:[&>div]:shadow-md hover:[&>div]:-translate-y-[1px]',
            )}
          >
            {isManual ? (
              <>
                <span className="absolute left-[6px] top-4 h-6 w-6 rounded-full bg-amber-400 ring-4 ring-amber-200/60" />
                <span className="absolute -right-1 top-2 inline-flex items-center gap-1 rounded-lg bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                  <Hand className="h-3 w-3" />
                  人工修改
                </span>
              </>
            ) : (
              <span className="absolute left-[10px] top-5 h-4 w-4 rounded-full border-2 border-slate-300 bg-white" />
            )}

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/50 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <code className="font-mono text-[11px] text-slate-500">
                    {formatTime(h.time)}
                  </code>
                  <span className="h-3 w-px bg-slate-200" />
                  <span className="text-xs font-medium text-slate-700">{h.operator}</span>
                </div>
                <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500 ring-1 ring-slate-200">
                  {ACTION_LABEL[h.action]}
                </span>
              </div>

              <div className="space-y-2.5 p-4">
                <p className="text-sm font-semibold text-slate-800">{h.summary}</p>

                {h.reason && (
                  <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500 ring-1 ring-slate-100">
                    {h.reason}
                  </div>
                )}

                {h.action === 'rejudge' && oldConc && newConc && (
                  <div className="flex items-center gap-2 rounded-lg bg-emerald-50/60 px-3 py-2 ring-1 ring-emerald-100">
                    <StatusBadge conclusion={oldConc as Conclusion} />
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" />
                    <StatusBadge conclusion={newConc as Conclusion} />
                  </div>
                )}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
