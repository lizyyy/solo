import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { RotateCcw, Search } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

const statusOptions = [
  { value: "", label: "全部状态" },
  { value: "normal", label: "正常" },
  { value: "warning", label: "警告" },
  { value: "critical", label: "严重" },
  { value: "corrected", label: "已更正" },
];

const anomalyOptions = [
  { value: "", label: "全部类型" },
  { value: "nofly", label: "禁飞区擦边" },
  { value: "integrity", label: "数据完整性" },
  { value: "anomaly", label: "异常识别" },
];

export default function FilterBar() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { filters, setFilters, resetFilters, syncFiltersFromURL, filtersToSearchParams } =
    useAppStore();

  useEffect(() => {
    syncFiltersFromURL(searchParams);
  }, []);

  useEffect(() => {
    const newParams = filtersToSearchParams();
    setSearchParams(newParams, { replace: true });
  }, [filters]);

  return (
    <div className="card card-body">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-500">开始日期</label>
          <input
            type="date"
            className="input-base w-40"
            value={filters.dateRange?.[0] ?? ""}
            onChange={(e) => {
              const start = e.target.value;
              const end = filters.dateRange?.[1] ?? "";
              setFilters({ dateRange: start || end ? [start, end] : null });
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-500">结束日期</label>
          <input
            type="date"
            className="input-base w-40"
            value={filters.dateRange?.[1] ?? ""}
            onChange={(e) => {
              const start = filters.dateRange?.[0] ?? "";
              const end = e.target.value;
              setFilters({ dateRange: start || end ? [start, end] : null });
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-500">杆塔编号</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              className="input-base w-44 pl-8"
              placeholder="搜索杆塔编号"
              value={filters.towerId ?? ""}
              onChange={(e) => setFilters({ towerId: e.target.value || null })}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-500">状态</label>
          <select
            className="input-base w-32"
            value={filters.status ?? ""}
            onChange={(e) => setFilters({ status: e.target.value || null })}
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-gray-500">异常类型</label>
          <select
            className="input-base w-36"
            value={filters.severity ?? ""}
            onChange={(e) => setFilters({ severity: e.target.value || null })}
          >
            {anomalyOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <button
          className="btn-secondary h-[38px]"
          onClick={resetFilters}
        >
          <RotateCcw className="w-4 h-4" />
          重置
        </button>
      </div>
    </div>
  );
}
