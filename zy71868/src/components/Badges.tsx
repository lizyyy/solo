import { cn } from "@/lib/utils"
import type { RecordStatus, ChangeType, Source, UserRole } from "@/types"
import {
  STATUS_LABELS,
  CHANGE_TYPE_LABELS,
  SOURCE_LABELS,
  ROLE_LABELS,
} from "@/types"

export function StatusBadge({ status }: { status: RecordStatus }) {
  const styles: Record<RecordStatus, string> = {
    pending: "bg-red-50 text-red-700 border-red-200",
    confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
    closed: "bg-gray-50 text-gray-500 border-gray-200",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        styles[status]
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}

export function ChangeTypeBadge({ changeType }: { changeType: ChangeType }) {
  const styles: Record<ChangeType, string> = {
    supplementary: "bg-navy-50 text-navy-600 border-navy-200",
    conclusion_change: "bg-amber-50 text-amber-700 border-amber-200",
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        styles[changeType]
      )}
    >
      {CHANGE_TYPE_LABELS[changeType]}
    </span>
  )
}

export function SourceBadge({ source }: { source: Source }) {
  return (
    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
      {SOURCE_LABELS[source]}
    </span>
  )
}

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className="text-xs text-slate-400">
      {ROLE_LABELS[role]}
    </span>
  )
}
