import { useQueueStore } from "@/store/useQueueStore";
import type { EventStatus, ExceptionType } from "@/types";
import { STATUS_LABELS, EXCEPTION_LABELS } from "@/types";
import {
  Filter,
  X,
  RotateCcw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";

const STATUS_OPTIONS: EventStatus[] = [
  "pending",
  "processing",
  "success",
  "failed",
  "pending_confirm_idempotency",
  "pending_confirm_audit_gap",
  "pending_confirm_param_corrupted",
  "revoked",
];

const EXCEPTION_OPTIONS: ExceptionType[] = [
  "none",
  "idempotency_key_collision",
  "audit_log_gap",
  "client_param_corrupted",
];

export default function FilterPanel() {
  const { filter, setFilter, resetFilter, events } = useQueueStore();
  const [statusOpen, setStatusOpen] = useState(true);
  const [exceptionOpen, setExceptionOpen] = useState(true);

  const clientIds = [...new Set(events.map((e) => e.clientId))].sort();

  const activeCount =
    filter.statuses.length +
    filter.exceptionTypes.length +
    (filter.clientId ? 1 : 0) +
    (filter.idempotencyKeySearch ? 1 : 0) +
    (filter.timeRangeStart ? 1 : 0) +
    (filter.timeRangeEnd ? 1 : 0);

  const toggleStatus = (status: EventStatus) => {
    const current = filter.statuses;
    const next = current.includes(status)
      ? current.filter((s) => s !== status)
      : [...current, status];
    setFilter({ statuses: next });
  };

  const toggleException = (type: ExceptionType) => {
    const current = filter.exceptionTypes;
    const next = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    setFilter({ exceptionTypes: next });
  };

  return (
    <aside className="w-64 flex-shrink-0 border-r border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-y-auto">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <Filter className="w-4 h-4" />
          筛选条件
          {activeCount > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs font-bold">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            onClick={resetFilter}
            className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
            重置
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
            幂等键搜索
          </label>
          <div className="relative">
            <input
              type="text"
              value={filter.idempotencyKeySearch}
              onChange={(e) =>
                setFilter({ idempotencyKeySearch: e.target.value })
              }
              placeholder="输入幂等键..."
              className="w-full px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            />
            {filter.idempotencyKeySearch && (
              <button
                onClick={() => setFilter({ idempotencyKeySearch: "" })}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <div>
          <button
            onClick={() => setStatusOpen(!statusOpen)}
            className="flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2 w-full"
          >
            {statusOpen ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            事件状态
            {filter.statuses.length > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                ({filter.statuses.length})
              </span>
            )}
          </button>
          {statusOpen && (
            <div className="flex flex-wrap gap-1">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  onClick={() => toggleStatus(status)}
                  className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                    filter.statuses.includes(status)
                      ? "bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300"
                      : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500"
                  }`}
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <button
            onClick={() => setExceptionOpen(!exceptionOpen)}
            className="flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2 w-full"
          >
            {exceptionOpen ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
            异常类型
            {filter.exceptionTypes.length > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                ({filter.exceptionTypes.length})
              </span>
            )}
          </button>
          {exceptionOpen && (
            <div className="flex flex-wrap gap-1">
              {EXCEPTION_OPTIONS.map((type) => (
                <button
                  key={type}
                  onClick={() => toggleException(type)}
                  className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                    filter.exceptionTypes.includes(type)
                      ? "bg-amber-50 dark:bg-amber-950/40 border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-300"
                      : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500"
                  }`}
                >
                  {EXCEPTION_LABELS[type]}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
            接入方
          </label>
          <select
            value={filter.clientId}
            onChange={(e) => setFilter({ clientId: e.target.value })}
            className="w-full px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
          >
            <option value="">全部</option>
            {clientIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2">
            时间范围
          </label>
          <div className="space-y-2">
            <input
              type="date"
              value={
                filter.timeRangeStart
                  ? new Date(filter.timeRangeStart).toISOString().slice(0, 10)
                  : ""
              }
              onChange={(e) =>
                setFilter({
                  timeRangeStart: e.target.value
                    ? new Date(e.target.value).getTime()
                    : null,
                })
              }
              className="w-full px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            />
            <input
              type="date"
              value={
                filter.timeRangeEnd
                  ? new Date(filter.timeRangeEnd).toISOString().slice(0, 10)
                  : ""
              }
              onChange={(e) =>
                setFilter({
                  timeRangeEnd: e.target.value
                    ? new Date(e.target.value).getTime() + 86400000
                    : null,
                })
              }
              className="w-full px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-600 rounded-md bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500"
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
