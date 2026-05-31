import type { AuditEntry } from "@/types"
import { ChangeTypeBadge, RoleBadge } from "@/components/Badges"
import { cn } from "@/lib/utils"

interface AuditTimelineProps {
  entries: AuditEntry[]
}

export function AuditTimeline({ entries }: AuditTimelineProps) {
  const sorted = [...entries].sort(
    (a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const month = d.getMonth() + 1
    const day = d.getDate()
    const h = d.getHours().toString().padStart(2, "0")
    const m = d.getMinutes().toString().padStart(2, "0")
    return `${month}/${day} ${h}:${m}`
  }

  return (
    <div className="relative">
      <div className="absolute left-[5px] top-2 bottom-2 w-px bg-slate-200" />
      <div className="space-y-4">
        {sorted.map((entry) => (
          <div key={entry.id} className="relative flex gap-3">
            <div
              className={cn(
                "relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2",
                entry.changeType === "supplementary"
                  ? "border-navy-300 bg-navy-100"
                  : "border-amber-400 bg-amber-100"
              )}
            />
            <div className="min-w-0 flex-1 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-slate-400">
                  {formatTime(entry.timestamp)}
                </span>
                <span className="text-xs font-medium text-slate-700">
                  {entry.operator}
                </span>
                <RoleBadge role={entry.role} />
                <span className="text-xs text-slate-500">{entry.action}</span>
                <ChangeTypeBadge changeType={entry.changeType} />
              </div>
              <p className="mt-1 text-sm text-slate-600">{entry.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
