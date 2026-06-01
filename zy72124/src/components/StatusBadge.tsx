import type { JudgmentStatus } from "@/types"
import { Shield, AlertTriangle, XCircle } from "lucide-react"

const STATUS_CONFIG: Record<JudgmentStatus, { bg: string; text: string; border: string; icon: typeof Shield; label: string }> = {
  pass: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    border: "border-emerald-500/30",
    icon: Shield,
    label: "通过",
  },
  confirm: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    border: "border-amber-500/30",
    icon: AlertTriangle,
    label: "需人工确认",
  },
  exceed: {
    bg: "bg-red-500/10",
    text: "text-red-400",
    border: "border-red-500/30",
    icon: XCircle,
    label: "超限告警",
  },
}

interface StatusBadgeProps {
  status: JudgmentStatus
  size?: "sm" | "md"
}

export function StatusBadge({ status, size = "sm" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1"

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border font-mono ${config.bg} ${config.text} ${config.border} ${sizeClasses}`}>
      <Icon className={size === "sm" ? "w-3 h-3" : "w-4 h-4"} />
      {config.label}
    </span>
  )
}
