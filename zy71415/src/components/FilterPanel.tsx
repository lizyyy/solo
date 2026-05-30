import { useStore } from "@/store/useStore"
import { BANKS } from "@/data/mockData"
import type { CollectStatus } from "@/types"
import { Filter, X, RotateCcw } from "lucide-react"

const STATUS_OPTIONS: { value: CollectStatus; label: string }[] = [
  { value: "processed", label: "已处理" },
  { value: "pending", label: "待确认" },
  { value: "returned", label: "退回补材料" },
]

export default function FilterPanel() {
  const filter = useStore((s) => s.filter)
  const setFilter = useStore((s) => s.setFilter)
  const resetFilter = useStore((s) => s.resetFilter)

  const hasFilter =
    filter.banks.length > 0 ||
    filter.statuses.length > 0 ||
    filter.ruleVersion !== "" ||
    filter.searchKeyword !== ""

  return (
    <div className="bg-[#13161f] border border-zinc-800/60 rounded-xl px-5 py-4">
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-4 h-4 text-sky-400" />
        <span className="text-sm font-medium text-zinc-300">筛选条件</span>
        {hasFilter && (
          <button
            onClick={resetFilter}
            className="ml-auto flex items-center gap-1 text-xs text-zinc-500 hover:text-sky-400 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            重置
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500 shrink-0">日期</label>
          <input
            type="date"
            value={filter.dateRange[0]}
            onChange={(e) => setFilter({ dateRange: [e.target.value, filter.dateRange[1]] })}
            className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-sky-500/50 font-mono"
          />
          <span className="text-zinc-600 text-xs">至</span>
          <input
            type="date"
            value={filter.dateRange[1]}
            onChange={(e) => setFilter({ dateRange: [filter.dateRange[0], e.target.value] })}
            className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-sky-500/50 font-mono"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500 shrink-0">银行</label>
          <div className="flex flex-wrap gap-1.5">
            {BANKS.map((bank) => {
              const active = filter.banks.includes(bank)
              return (
                <button
                  key={bank}
                  onClick={() =>
                    setFilter({
                      banks: active
                        ? filter.banks.filter((b) => b !== bank)
                        : [...filter.banks, bank],
                    })
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all duration-200 ${
                    active
                      ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                      : "bg-zinc-800/50 text-zinc-400 border border-zinc-700/30 hover:border-zinc-600"
                  }`}
                >
                  {bank}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500 shrink-0">状态</label>
          <div className="flex gap-1.5">
            {STATUS_OPTIONS.map((opt) => {
              const active = filter.statuses.includes(opt.value)
              return (
                <button
                  key={opt.value}
                  onClick={() =>
                    setFilter({
                      statuses: active
                        ? filter.statuses.filter((s) => s !== opt.value)
                        : [...filter.statuses, opt.value],
                    })
                  }
                  className={`px-2.5 py-1 rounded-lg text-xs transition-all duration-200 ${
                    active
                      ? "bg-sky-500/20 text-sky-400 border border-sky-500/30"
                      : "bg-zinc-800/50 text-zinc-400 border border-zinc-700/30 hover:border-zinc-600"
                  }`}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500 shrink-0">规则版本</label>
          <select
            value={filter.ruleVersion}
            onChange={(e) => setFilter({ ruleVersion: e.target.value })}
            className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-sky-500/50"
          >
            <option value="">全部版本</option>
            <option value="v3.2">v3.2</option>
            <option value="v3.1">v3.1</option>
            <option value="v3.0">v3.0</option>
          </select>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <div className="relative">
            <input
              type="text"
              placeholder="搜索账户名称/编号..."
              value={filter.searchKeyword}
              onChange={(e) => setFilter({ searchKeyword: e.target.value })}
              className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg pl-3 pr-8 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-sky-500/50 w-52 placeholder:text-zinc-600"
            />
            {filter.searchKeyword && (
              <button
                onClick={() => setFilter({ searchKeyword: "" })}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
