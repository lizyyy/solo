import { useState, useMemo, Fragment } from "react";
import {
  Download,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Filter,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import type { ConflictType, ConflictStatus } from "@/types";
import {
  formatConflictType,
  formatConflictStatus,
} from "@/utils/humanMessage";
import { exportConflictsCSV } from "@/utils/csvExport";
import { cn } from "@/lib/utils";

const CONFLICT_TYPE_OPTIONS: ConflictType[] = [
  "window_overlap",
  "telemetry_frame_drop",
  "time_system_mixed",
];

const CONFLICT_STATUS_OPTIONS: ConflictStatus[] = [
  "pending",
  "confirmed",
  "ignored",
];

const TYPE_DOT_COLORS: Record<ConflictType, string> = {
  window_overlap: "bg-blue-500",
  telemetry_frame_drop: "bg-emerald-500",
  time_system_mixed: "bg-violet-500",
};

const STATUS_BADGE_COLORS: Record<ConflictStatus, string> = {
  pending: "bg-amber-500/20 text-amber-400",
  confirmed: "bg-emerald-500/20 text-emerald-400",
  ignored: "bg-slate-500/20 text-slate-400",
};

export default function ConflictDetection() {
  const conflicts = useStore((s) => s.conflicts);
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const resetFilters = useStore((s) => s.resetFilters);
  const updateConflictStatus = useStore((s) => s.updateConflictStatus);
  const retractConflict = useStore((s) => s.retractConflict);

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const stationNames = useMemo(() => {
    const names = new Set(conflicts.map((c) => c.stationName));
    return Array.from(names).sort();
  }, [conflicts]);

  const filteredConflicts = useMemo(() => {
    return conflicts.filter((c) => {
      if (
        filters.conflictTypes.length > 0 &&
        !filters.conflictTypes.includes(c.type)
      )
        return false;
      if (
        filters.statuses.length > 0 &&
        !filters.statuses.includes(c.status)
      )
        return false;
      if (filters.stationName && !c.stationName.includes(filters.stationName))
        return false;
      if (filters.timeRangeStart) {
        if (
          new Date(c.detectedAt).getTime() <
          new Date(filters.timeRangeStart).getTime()
        )
          return false;
      }
      if (filters.timeRangeEnd) {
        if (
          new Date(c.detectedAt).getTime() >
          new Date(filters.timeRangeEnd).getTime()
        )
          return false;
      }
      return true;
    });
  }, [conflicts, filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.conflictTypes.length > 0) count++;
    if (filters.statuses.length > 0) count++;
    if (filters.stationName) count++;
    if (filters.timeRangeStart) count++;
    if (filters.timeRangeEnd) count++;
    return count;
  }, [filters]);

  const toggleType = (type: ConflictType) => {
    const next = filters.conflictTypes.includes(type)
      ? filters.conflictTypes.filter((t) => t !== type)
      : [...filters.conflictTypes, type];
    setFilters({ conflictTypes: next });
  };

  const toggleStatus = (status: ConflictStatus) => {
    const next = filters.statuses.includes(status)
      ? filters.statuses.filter((s) => s !== status)
      : [...filters.statuses, status];
    setFilters({ statuses: next });
  };

  const toggleStation = (name: string) => {
    setFilters({ stationName: filters.stationName === name ? "" : name });
  };

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isFilterActive = activeFilterCount > 0;

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">冲突检测</h1>
        <p className="mt-1 text-slate-400">
          查看并处理地面站资源冲突，确认或忽略检测结果
        </p>
      </div>

      <div className="mb-6 rounded-xl border border-slate-700 bg-slate-800/50 p-4">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-300">筛选条件</span>
          {isFilterActive && (
            <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
              {activeFilterCount}
            </span>
          )}
          <button
            onClick={resetFilters}
            className="ml-auto flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-slate-300"
          >
            <RotateCcw className="h-3 w-3" />
            重置
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs text-slate-400">
              冲突类型
            </span>
            <div className="flex flex-wrap gap-2">
              {CONFLICT_TYPE_OPTIONS.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs transition-colors",
                    filters.conflictTypes.includes(type)
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-slate-700/50 text-slate-400 hover:bg-slate-700"
                  )}
                >
                  {formatConflictType(type)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs text-slate-400">状态</span>
            <div className="flex flex-wrap gap-2">
              {CONFLICT_STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  onClick={() => toggleStatus(status)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs transition-colors",
                    filters.statuses.includes(status)
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-slate-700/50 text-slate-400 hover:bg-slate-700"
                  )}
                >
                  {formatConflictStatus(status)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs text-slate-400">站址</span>
            <div className="flex flex-wrap gap-2">
              {stationNames.map((name) => (
                <button
                  key={name}
                  onClick={() => toggleStation(name)}
                  className={cn(
                    "rounded-md px-3 py-1 text-xs transition-colors",
                    filters.stationName === name
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-slate-700/50 text-slate-400 hover:bg-slate-700"
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-xs text-slate-400">
              时间范围
            </span>
            <input
              type="date"
              value={filters.timeRangeStart}
              onChange={(e) => setFilters({ timeRangeStart: e.target.value })}
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1 text-xs text-slate-300 outline-none focus:border-amber-500"
            />
            <span className="text-xs text-slate-500">至</span>
            <input
              type="date"
              value={filters.timeRangeEnd}
              onChange={(e) => setFilters({ timeRangeEnd: e.target.value })}
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1 text-xs text-slate-300 outline-none focus:border-amber-500"
            />
          </div>
        </div>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm text-slate-400">
          共 {conflicts.length} 条冲突，当前显示 {filteredConflicts.length}{" "}
          条
        </span>
        <button
          onClick={() => exportConflictsCSV(conflicts, filters)}
          className="flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-600"
        >
          <Download className="h-4 w-4" />
          导出 CSV
          {isFilterActive && (
            <span className="text-xs text-slate-500">按当前筛选导出</span>
          )}
        </button>
      </div>

      {filteredConflicts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <CheckCircle2 className="mb-4 h-12 w-12 text-slate-600" />
          <p className="text-slate-500">未检测到资源冲突</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/80">
                <th className="px-4 py-3 text-left font-medium text-slate-400">
                  冲突类型
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">
                  状态
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">
                  站址
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">
                  描述
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">
                  人话提示
                </th>
                <th className="px-4 py-3 text-left font-medium text-slate-400">
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredConflicts.map((conflict) => {
                const isExpanded = expandedRows.has(conflict.id);

                return (
                  <Fragment key={conflict.id}>
                    <tr
                      className={cn(
                        "cursor-pointer border-b border-slate-700/50 border-l-2 transition-colors hover:bg-slate-700/30",
                        conflict.status === "pending" &&
                          "border-l-amber-500 bg-amber-500/10",
                        conflict.status === "confirmed" &&
                          "border-l-transparent bg-[#0F172A]",
                        conflict.status === "ignored" &&
                          "border-l-slate-600 bg-slate-800"
                      )}
                      onClick={() => toggleRow(conflict.id)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              TYPE_DOT_COLORS[conflict.type]
                            )}
                          />
                          {formatConflictType(conflict.type)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-xs",
                              STATUS_BADGE_COLORS[conflict.status]
                            )}
                          >
                            {formatConflictStatus(conflict.status)}
                          </span>
                          {conflict.retractedFrom && (
                            <span className="text-xs text-slate-500">
                              （已撤回）
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {conflict.stationName}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-slate-400">
                        {conflict.description}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="max-w-[200px] truncate text-slate-400">
                            {conflict.humanMessage}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3 shrink-0 text-slate-500" />
                          ) : (
                            <ChevronDown className="h-3 w-3 shrink-0 text-slate-500" />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {conflict.status === "pending" && (
                            <>
                              <button
                                onClick={() =>
                                  updateConflictStatus(conflict.id, "confirmed")
                                }
                                className="rounded-md bg-emerald-600/20 px-3 py-1 text-xs text-emerald-400 transition-colors hover:bg-emerald-600/30"
                              >
                                确认
                              </button>
                              <button
                                onClick={() =>
                                  updateConflictStatus(conflict.id, "ignored")
                                }
                                className="rounded-md bg-slate-600/50 px-3 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-600"
                              >
                                忽略
                              </button>
                            </>
                          )}
                          {(conflict.status === "confirmed" ||
                            conflict.status === "ignored") && (
                            <button
                              onClick={() => retractConflict(conflict.id)}
                              className="rounded-md bg-amber-600/20 px-3 py-1 text-xs text-amber-400 transition-colors hover:bg-amber-600/30"
                            >
                              撤回
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr
                        key={`${conflict.id}-expanded`}
                        className="border-b border-slate-700/50 bg-slate-800/30"
                      >
                        <td colSpan={6} className="px-4 py-3">
                          <div className="text-sm text-slate-400">
                            {conflict.humanMessage}
                          </div>
                          {conflict.versionChanged && (
                            <div className="mt-2 flex items-center gap-2">
                              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">
                                版本已变更
                              </span>
                              {conflict.versionChangeNote && (
                                <span className="text-xs text-slate-500">
                                  {conflict.versionChangeNote}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
