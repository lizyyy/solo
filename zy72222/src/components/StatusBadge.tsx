import type { RecordStatus } from "@/types"
import { CheckCircle, Clock, AlertTriangle } from "lucide-react"

const statusConfig: Record<
  RecordStatus,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  normal: {
    label: "正常",
    color: "text-teal-700",
    bg: "bg-teal-50 border-teal-200",
    icon: <CheckCircle className="w-3.5 h-3.5" />,
  },
  pending_review: {
    label: "待复核",
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  pending_supplement: {
    label: "待补录",
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    icon: <Clock className="w-3.5 h-3.5" />,
  },
}

export default function StatusBadge({ status }: { status: RecordStatus }) {
  const cfg = statusConfig[status]
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.bg} ${cfg.color}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  )
}
