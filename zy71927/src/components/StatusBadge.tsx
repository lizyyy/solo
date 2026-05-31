import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  status: string
  type?: "record" | "insurance" | "lighting" | "exhibition" | "evidence"
}

const statusStyles: Record<string, Record<string, string>> = {
  record: {
    draft: "bg-gray-100 text-gray-700 border-gray-200",
    in_progress: "bg-blue-100 text-blue-700 border-blue-200",
    completed: "bg-green-100 text-green-700 border-green-200",
    archived: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
  insurance: {
    active: "bg-green-100 text-green-700 border-green-200",
    expired: "bg-red-100 text-red-700 border-red-200",
    pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
    cancelled: "bg-gray-100 text-gray-700 border-gray-200",
  },
  lighting: {
    linked: "bg-green-100 text-green-700 border-green-200",
    missing: "bg-red-100 text-red-700 border-red-200",
  },
  exhibition: {
    linked: "bg-green-100 text-green-700 border-green-200",
    missing: "bg-red-100 text-red-700 border-red-200",
  },
  evidence: {
    linked: "bg-green-100 text-green-700 border-green-200",
    missing: "bg-red-100 text-red-700 border-red-200",
    duplicate: "bg-yellow-100 text-yellow-700 border-yellow-200",
  },
}

const statusLabels: Record<string, Record<string, string>> = {
  record: {
    draft: "草稿",
    in_progress: "进行中",
    completed: "已完成",
    archived: "已归档",
  },
  insurance: {
    active: "有效",
    expired: "已过期",
    pending: "待生效",
    cancelled: "已取消",
  },
  lighting: {
    linked: "已关联",
    missing: "未关联",
  },
  exhibition: {
    linked: "已关联",
    missing: "未关联",
  },
  evidence: {
    linked: "已关联",
    missing: "未关联",
    duplicate: "重复",
  },
}

export default function StatusBadge({ status, type = "record" }: StatusBadgeProps) {
  const styles = statusStyles[type]?.[status] || "bg-gray-100 text-gray-700 border-gray-200"
  const label = statusLabels[type]?.[status] || status

  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        styles
      )}
    >
      {label}
    </span>
  )
}
