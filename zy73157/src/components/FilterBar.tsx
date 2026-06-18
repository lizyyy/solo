import { Filter, X } from "lucide-react";
import { useStore } from "@/store";
import type { RecordStatus, AnomalyType, SamplingParameter } from "@/types";
import { statusConfig, anomalyConfig, parameterConfig } from "@/components/Badges";
import { cn } from "@/lib/utils";

export function FilterBar() {
  const { filters, setFilters } = useStore();

  const hasActiveFilters =
    filters.status !== "all" ||
    filters.anomalyType !== "all" ||
    filters.parameter !== "all" ||
    !filters.showWithdrawn ||
    !filters.showDriftAffected;

  const clearAll = () => {
    setFilters({
      status: "all",
      anomalyType: "all",
      parameter: "all",
      showWithdrawn: true,
      showDriftAffected: true,
    });
  };

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-3">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-slate-500">
          <Filter className="w-4 h-4" />
          <span className="text-sm font-medium">筛选</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">状态:</span>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ status: e.target.value as RecordStatus | "all" })}
            className="text-sm border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部</option>
            <option value="resolved">{statusConfig.resolved.label}</option>
            <option value="pending_evidence">{statusConfig.pending_evidence.label}</option>
            <option value="blocked">{statusConfig.blocked.label}</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">异常类型:</span>
          <select
            value={filters.anomalyType}
            onChange={(e) => setFilters({ anomalyType: e.target.value as AnomalyType | "all" })}
            className="text-sm border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部</option>
            <option value="value_exceeded">{anomalyConfig.value_exceeded.label}</option>
            <option value="sensor_drift">{anomalyConfig.sensor_drift.label}</option>
            <option value="withdrawal">{anomalyConfig.withdrawal.label}</option>
            <option value="abnormal_trend">{anomalyConfig.abnormal_trend.label}</option>
            <option value="missing_data">{anomalyConfig.missing_data.label}</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">参数:</span>
          <select
            value={filters.parameter}
            onChange={(e) => setFilters({ parameter: e.target.value as SamplingParameter | "all" })}
            className="text-sm border border-slate-200 rounded-md px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">全部</option>
            {Object.entries(parameterConfig).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>

        <div className="h-6 w-px bg-slate-200" />

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.showWithdrawn}
            onChange={(e) => setFilters({ showWithdrawn: e.target.checked })}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-600">显示已撤回</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={filters.showDriftAffected}
            onChange={(e) => setFilters({ showDriftAffected: e.target.checked })}
            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-slate-600">显示漂移影响</span>
        </label>

        {hasActiveFilters && (
          <button
            onClick={clearAll}
            className="ml-auto flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            <X className="w-3 h-3" />
            清除筛选
          </button>
        )}
      </div>
    </div>
  );
}
