import { Download } from "lucide-react"
import { useAppStore } from "@/store/useAppStore"
import { cn } from "@/lib/utils"
import { SOURCE_LABELS, STATUS_LABELS } from "@/types"
import type { DataSourceType, RecordStatus } from "@/types"

const sourceOptions: { value: DataSourceType | "all"; label: string }[] = [
  { value: "all", label: "全部来源" },
  { value: "evaluation", label: SOURCE_LABELS.evaluation },
  { value: "online_feedback", label: SOURCE_LABELS.online_feedback },
  { value: "config", label: SOURCE_LABELS.config },
]

const statusOptions: { value: RecordStatus | "all"; label: string }[] = [
  { value: "all", label: "全部状态" },
  { value: "confirmed", label: STATUS_LABELS.confirmed },
  { value: "pending", label: STATUS_LABELS.pending },
  { value: "manual_modified", label: STATUS_LABELS.manual_modified },
  { value: "importing", label: STATUS_LABELS.importing },
]

const timeOptions: { value: "7d" | "30d" | "all"; label: string }[] = [
  { value: "7d", label: "近7天" },
  { value: "30d", label: "近30天" },
  { value: "all", label: "全部时间" },
]

function exportCSV() {
  const store = useAppStore.getState()
  const metrics = store.getFilteredMetrics()
  if (metrics.length === 0) return

  const header = "指标名,值,来源,口径版本,口径说明,口径变更"
  const rows = metrics.map((m) =>
    [m.name, m.value, SOURCE_LABELS[m.source], m.caliberVersion, m.caliberNote, m.caliberChanged ? "是" : "否"].join(",")
  )
  const csv = [header, ...rows].join("\n")
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `实验指标_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function FilterBar() {
  const filters = useAppStore((s) => s.filters)
  const setFilters = useAppStore((s) => s.setFilters)

  return (
    <div className="flex items-center justify-between gap-4 rounded-md bg-slate-800/60 px-4 py-3">
      <div className="flex items-center gap-3">
        <select
          value={filters.source}
          onChange={(e) => setFilters({ source: e.target.value as DataSourceType | "all" })}
          className={cn(
            "h-8 rounded border border-slate-700 bg-slate-900 px-2.5 text-sm text-slate-200",
            "focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
          )}
        >
          {sourceOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(e) => setFilters({ status: e.target.value as RecordStatus | "all" })}
          className={cn(
            "h-8 rounded border border-slate-700 bg-slate-900 px-2.5 text-sm text-slate-200",
            "focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
          )}
        >
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        <select
          value={filters.timeRange}
          onChange={(e) => setFilters({ timeRange: e.target.value as "7d" | "30d" | "all" })}
          className={cn(
            "h-8 rounded border border-slate-700 bg-slate-900 px-2.5 text-sm text-slate-200",
            "focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500/40"
          )}
        >
          {timeOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <button
        onClick={exportCSV}
        className={cn(
          "flex items-center gap-1.5 rounded border border-amber-500/60 bg-amber-500/10 px-3 py-1.5",
          "text-sm text-amber-400 transition-colors hover:bg-amber-500/20"
        )}
      >
        <Download className="h-3.5 w-3.5" />
        导出 CSV
      </button>
    </div>
  )
}
