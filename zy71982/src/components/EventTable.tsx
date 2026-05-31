import { useQueueStore } from "@/store/useQueueStore";
import StatusTag from "@/components/StatusTag";
import { getRowHighlight, formatTimestamp, formatRelativeTime } from "@/utils/statusHelpers";
import { getExceptionLabel } from "@/utils/statusHelpers";
import { isPendingConfirm } from "@/utils/statusHelpers";
import { useNavigate } from "react-router-dom";
import { CheckSquare, Square, ExternalLink, AlertTriangle } from "lucide-react";

interface EventTableProps {
  onExport: () => void;
}

export default function EventTable({ onExport }: EventTableProps) {
  const {
    getFilteredEvents,
    selectedEventIds,
    toggleEventSelection,
    selectAllFiltered,
    clearSelection,
  } = useQueueStore();

  const filteredEvents = getFilteredEvents();
  const navigate = useNavigate();
  const allSelected =
    filteredEvents.length > 0 &&
    filteredEvents.every((e) => selectedEventIds.includes(e.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      clearSelection();
    } else {
      selectAllFiltered(filteredEvents.map((e) => e.id));
    }
  };

  const pendingConfirmCount = filteredEvents.filter((e) =>
    isPendingConfirm(e.status)
  ).length;

  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 flex items-center justify-between bg-white dark:bg-zinc-900">
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            共 <span className="font-semibold text-zinc-800 dark:text-zinc-200">{filteredEvents.length}</span> 条事件
          </span>
          {pendingConfirmCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-medium">
              <AlertTriangle className="w-3 h-3" />
              {pendingConfirmCount} 条待确认
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedEventIds.length > 0 && (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                已选 {selectedEventIds.length} 条
              </span>
              <BatchActionButtons />
            </div>
          )}
          <button
            onClick={onExport}
            className="px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
          >
            导出
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-800/80 backdrop-blur-sm z-10">
            <tr className="border-b border-zinc-200 dark:border-zinc-700">
              <th className="w-10 px-3 py-2.5">
                <button onClick={toggleSelectAll} className="p-0.5">
                  {allSelected ? (
                    <CheckSquare className="w-4 h-4 text-amber-500" />
                  ) : (
                    <Square className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                  )}
                </button>
              </th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                事件ID
              </th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                幂等键
              </th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                状态
              </th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                异常
              </th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                接入方
              </th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                创建时间
              </th>
              <th className="text-left px-3 py-2.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                最后更新
              </th>
              <th className="w-10 px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {filteredEvents.map((event) => (
              <tr
                key={event.id}
                className={`group transition-colors ${getRowHighlight(event.status)} ${
                  selectedEventIds.includes(event.id)
                    ? "bg-amber-50/70 dark:bg-amber-950/30"
                    : ""
                }`}
              >
                <td className="px-3 py-2.5">
                  <button
                    onClick={() => toggleEventSelection(event.id)}
                    className="p-0.5"
                  >
                    {selectedEventIds.includes(event.id) ? (
                      <CheckSquare className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Square className="w-4 h-4 text-zinc-400 dark:text-zinc-500" />
                    )}
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300">
                    {event.id}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
                    {event.idempotencyKey}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <StatusTag status={event.status} compact />
                </td>
                <td className="px-3 py-2.5">
                  {event.exceptionType !== "none" && (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="w-3 h-3" />
                      {getExceptionLabel(event.exceptionType)}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-xs text-zinc-600 dark:text-zinc-400">
                  {event.clientId}
                </td>
                <td className="px-3 py-2.5 text-xs text-zinc-500 dark:text-zinc-400" title={formatTimestamp(event.createdAt)}>
                  {formatRelativeTime(event.createdAt)}
                </td>
                <td className="px-3 py-2.5 text-xs text-zinc-500 dark:text-zinc-400" title={formatTimestamp(event.updatedAt)}>
                  {formatRelativeTime(event.updatedAt)}
                </td>
                <td className="px-3 py-2.5">
                  <button
                    onClick={() => navigate(`/event/${event.id}`)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                    title="查看详情"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {filteredEvents.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="text-center py-12 text-zinc-400 dark:text-zinc-500 text-sm"
                >
                  暂无符合条件的事件
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BatchActionButtons() {
  const { selectedEventIds, batchConfirm, clearSelection } = useQueueStore();
  const operator = "admin";

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => {
          batchConfirm(selectedEventIds, "success", operator);
          clearSelection();
        }}
        className="px-2 py-1 text-xs font-medium rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors"
      >
        批量确认成功
      </button>
      <button
        onClick={() => {
          batchConfirm(selectedEventIds, "failed", operator);
          clearSelection();
        }}
        className="px-2 py-1 text-xs font-medium rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60 transition-colors"
      >
        批量确认失败
      </button>
    </div>
  );
}
