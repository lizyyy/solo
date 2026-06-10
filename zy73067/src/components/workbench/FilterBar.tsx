import { Search, Filter, RotateCcw, Flame } from "lucide-react";
import { useReviewStore } from "@/store/reviewStore";
import type { StatusFilter } from "@/types";

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "全部状态" },
  { value: "pending", label: "待复核" },
  { value: "reviewing", label: "复核中" },
  { value: "approved", label: "已通过" },
  { value: "rejected", label: "已驳回" },
];

const sources = ["", "备件清单A", "巡检表B", "月度汇总", "现场报告", "供应商清单"];

export default function FilterBar() {
  const { filters, setFilters, resetFilters } = useReviewStore();

  return (
    <div className="card-surface p-4 border border-gray-200">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-industrial-700 font-semibold text-sm">
          <Filter size={16} strokeWidth={2} />
          <span>筛选条件</span>
        </div>

        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            strokeWidth={2}
          />
          <input
            type="text"
            placeholder="搜索设备编号（支持多种写法自动归一化匹配）"
            value={filters.searchQuery}
            onChange={(e) => setFilters({ searchQuery: e.target.value })}
            className="input-field pl-9 pr-4"
          />
        </div>

        <div className="inline-flex items-center rounded-industrial border border-gray-300 overflow-hidden">
          {statusOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilters({ status: opt.value })}
              className={`px-3 py-2 text-sm transition-colors ${
                filters.status === opt.value
                  ? "bg-industrial-600 text-white"
                  : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <select
          value={filters.source}
          onChange={(e) => setFilters({ source: e.target.value })}
          className="input-field w-auto min-w-[140px]"
        >
          {sources.map((s) => (
            <option key={s || "all"} value={s}>
              {s || "全部来源"}
            </option>
          ))}
        </select>

        <label
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-industrial cursor-pointer border transition-all ${
            filters.showTempAdjustedOnly
              ? "bg-alert-50 border-alert-300 text-alert-600"
              : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Flame
            size={16}
            className={filters.showTempAdjustedOnly ? "text-alert-500" : ""}
            strokeWidth={2}
          />
          <span className="text-sm font-medium">仅看临时阈值调高</span>
          <div
            className={`relative w-10 h-5 rounded-full transition-colors ${
              filters.showTempAdjustedOnly ? "bg-alert-500" : "bg-gray-300"
            }`}
          >
            <div
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                filters.showTempAdjustedOnly ? "left-5" : "left-0.5"
              }`}
            />
          </div>
          <input
            type="checkbox"
            className="sr-only"
            checked={filters.showTempAdjustedOnly}
            onChange={(e) => setFilters({ showTempAdjustedOnly: e.target.checked })}
          />
        </label>

        <button
          onClick={resetFilters}
          className="btn-outline inline-flex items-center gap-1.5"
        >
          <RotateCcw size={14} strokeWidth={2} />
          <span>重置</span>
        </button>
      </div>
    </div>
  );
}
