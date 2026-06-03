import type { TimelineEvent } from "@/types"

const colorMap: Record<string, string> = {
  import: "bg-[#00D68F]",
  caliber_change: "bg-[#FFAA00]",
  supplement: "bg-[#8B5CF6]",
  review: "bg-[#3B82F6]",
  rerun: "bg-[#F97316]",
}

function getNodeColor(type: string) {
  return colorMap[type] ?? "bg-slate-500"
}

interface TimelineProps {
  events: TimelineEvent[]
}

export default function Timeline({ events }: TimelineProps) {
  const sorted = [...events].sort((a, b) => {
    const ta = typeof a.timestamp === "number" ? a.timestamp : new Date(a.timestamp).getTime()
    const tb = typeof b.timestamp === "number" ? b.timestamp : new Date(b.timestamp).getTime()
    return tb - ta
  })

  return (
    <div className="relative pl-6">
      <div className="absolute left-[5px] top-0 bottom-0 w-0.5 bg-slate-700" />

      <div className="flex flex-col gap-y-4">
        {sorted.map((event) => (
          <div key={event.id ?? `${event.type}-${event.timestamp}`} className="relative">
            <div
              className={`absolute left-[-19px] top-1.5 w-3 h-3 rounded-full ${getNodeColor(event.type)}`}
            />

            <div className="text-xs text-slate-500 font-mono">
              {typeof event.timestamp === "number"
                ? new Date(event.timestamp).toLocaleString()
                : event.timestamp}
            </div>
            <div className="text-sm text-white">{event.description}</div>
            {event.detail && (
              <div className="text-xs text-slate-400 mt-0.5 pl-2 border-l border-slate-700">
                {event.detail}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
