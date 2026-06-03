import type { RecordStatus } from "@/types"

const statusConfig: Record<RecordStatus, { label: string; colorClass: string }> = {
  smooth: {
    label: "顺利",
    colorClass: "bg-emerald-100 text-emerald-700 border-emerald-200",
  },
  pending_review: {
    label: "待复核",
    colorClass: "bg-red-100 text-red-700 border-red-200",
  },
  supplemented: {
    label: "已补录",
    colorClass: "bg-amber-100 text-amber-700 border-amber-200",
  },
  reviewed: {
    label: "已复核",
    colorClass: "bg-blue-100 text-blue-700 border-blue-200",
  },
}

interface StatusBadgeProps {
  status: RecordStatus
  size?: "sm" | "md"
}

export default function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const config = statusConfig[status]
  const sizeClass = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${config.colorClass} ${sizeClass}`}
    >
      {config.label}
    </span>
  )
}
