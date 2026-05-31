import { HANDLING_TAG_LABELS } from "@/types"
import type { HandlingTag } from "@/types"
import { cn } from "@/lib/utils"

const tagColors: Record<HandlingTag, string> = {
  continue_observe: "bg-sky-100 text-sky-800",
  need_attachment: "bg-orange-100 text-orange-800",
  manually_corrected: "bg-violet-100 text-violet-800",
  resolved: "bg-emerald-100 text-emerald-800",
}

interface HandlingTagBadgeProps {
  tag: HandlingTag
}

export default function HandlingTagBadge({ tag }: HandlingTagBadgeProps) {
  return (
    <span className={cn("inline-flex items-center rounded px-2 py-0.5 text-xs font-medium", tagColors[tag])}>
      {HANDLING_TAG_LABELS[tag]}
    </span>
  )
}
