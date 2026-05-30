import type { TimelineEvent as TimelineEventType, TimelineEventType as ET } from '@/types'
import { EVENT_TYPE_LABELS } from '@/types'
import {
  FileText, BarChart3, XCircle, GitBranch, RefreshCw, CheckCircle2,
} from 'lucide-react'

const iconMap: Record<ET, typeof FileText> = {
  order_created: FileText,
  trade_report: BarChart3,
  order_cancelled: XCircle,
  cross_market_tag: GitBranch,
  rate_version_change: RefreshCw,
  conclusion: CheckCircle2,
}

const colorMap: Record<ET, string> = {
  order_created: 'bg-blue-500',
  trade_report: 'bg-emerald-500',
  order_cancelled: 'bg-amber-500',
  cross_market_tag: 'bg-purple-500',
  rate_version_change: 'bg-cyan-500',
  conclusion: 'bg-slate-300',
}

const borderColorMap: Record<ET, string> = {
  order_created: 'border-blue-500/40',
  trade_report: 'border-emerald-500/40',
  order_cancelled: 'border-amber-500/40',
  cross_market_tag: 'border-purple-500/40',
  rate_version_change: 'border-cyan-500/40',
  conclusion: 'border-slate-400/40',
}

interface Props {
  events: TimelineEventType[]
}

function formatTimestamp(iso: string) {
  const d = new Date(iso)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  const s = String(d.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

export default function TimelineView({ events }: Props) {
  return (
    <div className="relative pl-6">
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-slate-700/60" />
      <div className="space-y-4">
        {events.map((evt, i) => {
          const Icon = iconMap[evt.eventType]
          const dotColor = colorMap[evt.eventType]
          const bColor = borderColorMap[evt.eventType]
          const isLast = i === events.length - 1
          return (
            <div key={evt.id} className="relative flex gap-3">
              <div className={`absolute left-[-20px] top-1 w-[22px] h-[22px] rounded-full border-2 ${bColor} bg-slate-950 flex items-center justify-center z-10`}>
                <div className={`w-2 h-2 rounded-full ${dotColor}`} />
              </div>
              <div className={`flex-1 pb-${isLast ? '0' : '1'}`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <Icon size={13} className="text-slate-400" />
                  <span className="text-xs font-medium text-slate-200">
                    {EVENT_TYPE_LABELS[evt.eventType as ET]}
                  </span>
                  <span className="text-[10px] font-mono-amount text-slate-500">
                    {formatTimestamp(evt.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pl-5">
                  {evt.description}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
