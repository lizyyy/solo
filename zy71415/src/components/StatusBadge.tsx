import type { CollectStatus } from "@/types"
import { useStore } from "@/store/useStore"

const STATUS_CONFIG: Record<CollectStatus, { label: string; color: string; bgColor: string; dotColor: string }> = {
  processed: { label: "已处理", color: "text-emerald-400", bgColor: "bg-emerald-400/10", dotColor: "bg-emerald-400" },
  pending: { label: "待确认", color: "text-amber-400", bgColor: "bg-amber-400/10", dotColor: "bg-amber-400" },
  returned: { label: "退回补材料", color: "text-red-400", bgColor: "bg-red-400/10", dotColor: "bg-red-400" },
}

interface StatusBadgeProps {
  status: CollectStatus
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color} ${config.bgColor}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dotColor}`} />
      {config.label}
    </span>
  )
}

export function getStatusConfig(status: CollectStatus) {
  return STATUS_CONFIG[status]
}
