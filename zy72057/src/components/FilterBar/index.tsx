import { useUIStore } from "@/store/useUIStore"
import type { ItemStatus } from "@/types"
import { STATUS_LABELS } from "@/types"
import { Filter, Search } from "lucide-react"

const statusOptions: (ItemStatus | "all")[] = ["all", "normal", "duplicate", "offset", "missing_photo", "boundary", "empty_value"]

export default function FilterBar() {
  const { filterStatus, filterType, searchText, setFilterStatus, setFilterType, setSearchText } = useUIStore()

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-800/80 border-b border-slate-700">
      <Filter size={14} className="text-slate-400" />
      <select
        value={filterStatus}
        onChange={(e) => setFilterStatus(e.target.value as ItemStatus | "all")}
        className="bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-amber-500"
      >
        {statusOptions.map((s) => (
          <option key={s} value={s}>
            {s === "all" ? "全部状态" : STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <select
        value={filterType}
        onChange={(e) => setFilterType(e.target.value as "all" | "building" | "panel" | "inverter")}
        className="bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-amber-500"
      >
        <option value="all">全部类型</option>
        <option value="building">建筑</option>
        <option value="panel">光伏板</option>
        <option value="inverter">逆变器</option>
      </select>
      <div className="flex items-center gap-1.5 flex-1 max-w-xs">
        <Search size={14} className="text-slate-400" />
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="搜索设备名称..."
          className="bg-slate-700 text-slate-200 text-xs rounded px-2 py-1 border border-slate-600 focus:outline-none focus:border-amber-500 w-full"
        />
      </div>
      {filterStatus !== "all" && (
        <span className="text-xs text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded">
          筛选: {STATUS_LABELS[filterStatus as ItemStatus] ?? "全部"}
        </span>
      )}
    </div>
  )
}
