import type { SampleStatus } from "@/types"
import { STATUS_LABELS } from "@/types"
import { cn } from "@/lib/utils"

const STATUS_STYLES: Record<SampleStatus, string> = {
  model_judged: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  human_corrected: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  needs_review: "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
  duplicate: "bg-zinc-600/15 text-zinc-500 border-zinc-600/30",
}

interface StatusBadgeProps {
  status: SampleStatus
  className?: string
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        STATUS_STYLES[status],
        className
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
