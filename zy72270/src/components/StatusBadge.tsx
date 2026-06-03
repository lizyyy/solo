import { cn } from "@/lib/utils"
import type { RecordStatus } from "@/types"
import { STATUS_LABELS } from "@/types"

const STATUS_STYLES: Record<RecordStatus, string> = {
  normal: "bg-green-100 text-green-800",
  pending_review: "bg-amber-100 text-amber-800",
  supplemented: "bg-blue-100 text-blue-800",
  conflict: "bg-rose-100 text-rose-800",
  rejected: "bg-gray-100 text-gray-600",
}

interface StatusBadgeProps {
  status: RecordStatus
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status],
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
