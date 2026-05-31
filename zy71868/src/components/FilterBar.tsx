import { cn } from "@/lib/utils"
import type { RecordStatus, ChangeType, Source } from "@/types"
import { STATUS_LABELS, CHANGE_TYPE_LABELS, SOURCE_LABELS } from "@/types"

interface FilterBarProps {
  statusFilter: RecordStatus | "all"
  sourceFilter: Source | "all"
  changeTypeFilter: ChangeType | "all"
  onStatusChange: (v: RecordStatus | "all") => void
  onSourceChange: (v: Source | "all") => void
  onChangeTypeChange: (v: ChangeType | "all") => void
}

export function FilterBar({
  statusFilter,
  sourceFilter,
  changeTypeFilter,
  onStatusChange,
  onSourceChange,
  onChangeTypeChange,
}: FilterBarProps) {
  const pill = (active: boolean) =>
    cn(
      "inline-flex cursor-pointer items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors",
      active
        ? "border-navy-300 bg-navy-100 text-navy-800"
        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
    )

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-400 w-12 shrink-0">状态</span>
        <button
          className={pill(statusFilter === "all")}
          onClick={() => onStatusChange("all")}
        >
          全部
        </button>
        {(
          Object.entries(STATUS_LABELS) as [RecordStatus, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            className={pill(statusFilter === key)}
            onClick={() => onStatusChange(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-400 w-12 shrink-0">来源</span>
        <button
          className={pill(sourceFilter === "all")}
          onClick={() => onSourceChange("all")}
        >
          全部
        </button>
        {(Object.entries(SOURCE_LABELS) as [Source, string][]).map(
          ([key, label]) => (
            <button
              key={key}
              className={pill(sourceFilter === key)}
              onClick={() => onSourceChange(key)}
            >
              {label}
            </button>
          )
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-400 w-12 shrink-0">变更</span>
        <button
          className={pill(changeTypeFilter === "all")}
          onClick={() => onChangeTypeChange("all")}
        >
          全部
        </button>
        {(Object.entries(CHANGE_TYPE_LABELS) as [ChangeType, string][]).map(
          ([key, label]) => (
            <button
              key={key}
              className={pill(changeTypeFilter === key)}
              onClick={() => onChangeTypeChange(key)}
            >
              {label}
            </button>
          )
        )}
      </div>
    </div>
  )
}
