import type { AuditEvent, EventType } from '@/types'
import { EVENT_TYPE_LABELS } from '@/types'
import { cn } from '@/lib/utils'

const eventTypeConfig: Record<EventType, { dot: string; line: string; bg: string; text: string }> = {
  judgment: { dot: 'bg-amber-500', line: 'bg-amber-300', bg: 'bg-amber-50', text: 'text-amber-700' },
  correction: { dot: 'bg-steel', line: 'bg-steel/40', bg: 'bg-steel/10', text: 'text-steel' },
  attachment_add: { dot: 'bg-emerald-500', line: 'bg-emerald-300', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  status_change: { dot: 'bg-purple-500', line: 'bg-purple-300', bg: 'bg-purple-50', text: 'text-purple-700' },
  import: { dot: 'bg-gray-400', line: 'bg-gray-300', bg: 'bg-gray-50', text: 'text-gray-600' },
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface AuditTimelineProps {
  events: AuditEvent[]
  className?: string
}

export default function AuditTimeline({ events, className }: AuditTimelineProps) {
  const sorted = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  return (
    <div className={cn('relative', className)}>
      {sorted.map((event, idx) => {
        const config = eventTypeConfig[event.eventType]
        const isLast = idx === sorted.length - 1
        return (
          <div key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
            <div className="flex flex-col items-center">
              <div className={cn('w-3 h-3 rounded-full shrink-0 ring-4 ring-white z-10', config.dot)} />
              {!isLast && (
                <div className={cn('w-0.5 flex-1 mt-1', config.line)} />
              )}
            </div>
            <div className="flex-1 min-w-0 -mt-0.5">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', config.bg, config.text)}>
                  {EVENT_TYPE_LABELS[event.eventType]}
                </span>
                <span className="text-xs text-gray-400">{formatTime(event.timestamp)}</span>
              </div>
              <p className="text-sm text-primary">{event.description}</p>
              <p className="text-xs text-gray-400 mt-0.5">操作人：{event.actor}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
