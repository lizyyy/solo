import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatsCardProps {
  icon: LucideIcon
  label: string
  value: string | number
  valueSuffix?: string
  trend?: "up" | "down" | "neutral"
  color?: "success" | "danger" | "warning" | "info"
}

const colorClasses = {
  success: "text-success bg-success/10",
  danger: "text-danger bg-danger/10",
  warning: "text-warning bg-warning/10",
  info: "text-brand-400 bg-brand-400/10",
}

export default function StatsCard({
  icon: Icon,
  label,
  value,
  valueSuffix,
  color = "info",
}: StatsCardProps) {
  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400 mb-1">{label}</p>
          <p className="text-3xl font-bold">
            {value}
            {valueSuffix && (
              <span className="text-lg text-slate-500 ml-1">{valueSuffix}</span>
            )}
          </p>
        </div>
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center",
            colorClasses[color]
          )}
        >
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  )
}
