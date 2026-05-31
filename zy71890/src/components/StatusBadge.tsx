import { STATUS_LABELS } from "@/types"
import type { RecordStatus } from "@/types"
import { cn } from "@/lib/utils"

const statusColors: Record<RecordStatus, string> = {
  confirmed: "bg-emerald-100 text-emerald-800 border-emerald-300",
  pending: "bg-amber-100 text-amber-800 border-amber-300",
  manual_corrected: "bg-violet-100 text-violet-800 border-violet-300",
}

const statusDots: Record<RecordStatus, string> = {
  confirmed: "bg-emerald-500",
  pending: "bg-amber-500",
  manual_corrected: "bg-violet-500",
}

interface StatusBadgeProps {
  status: RecordStatus
  compact?: boolean
}

export default function StatusBadge({ status, compact = false }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border font-medium",
        statusColors[status],
        compact ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-xs"
      )}
    >
      <span className={cn("rounded-full", statusDots[status], compact ? "h-1.5 w-1.5" : "h-2 w-2")} />
      {STATUS_LABELS[status]}
    </span>
  )
}
