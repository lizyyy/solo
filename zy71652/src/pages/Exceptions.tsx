import { useState } from "react";
import {
  AlertTriangle,
  Check,
  X,
  Download,
  FileJson,
  FileSpreadsheet,
  StickyNote,
} from "lucide-react";
import { useWarehouseStore } from "@/store/useWarehouseStore";
import {
  generateJSONReport,
  generateCSVReport,
  downloadFile,
} from "@/utils/reportGenerator";
import type { RouteStatus, ExceptionType } from "@/types";

const STATUS_LABELS: Record<RouteStatus, string> = {
  draft: "草稿",
  stored: "暂存",
  confirmed: "已确认",
  rejected: "被退回",
};

const EXCEPTION_LABELS: Record<ExceptionType, string> = {
  duplicate_location: "库位重复",
  cold_chain_timeout: "冷链超时",
  path_backtrack: "路径回头",
};

export default function Exceptions() {
  const routes = useWarehouseStore((s) => s.routes);
  const orders = useWarehouseStore((s) => s.orders);
  const locations = useWarehouseStore((s) => s.locations);
  const exceptions = useWarehouseStore((s) => s.exceptions);
  const updateRoute = useWarehouseStore((s) => s.updateRoute);
  const updateRouteStatus = useWarehouseStore((s) => s.updateRouteStatus);
  const updateException = useWarehouseStore((s) => s.updateException);

  const [selectedRouteId, setSelectedRouteId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<RouteStatus | "all">("all");
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesText, setNotesText] = useState("");

  const selectedRoute = routes.find((r) => r.id === selectedRouteId);
  const routeExceptions = exceptions.filter(
    (e) => e.routeId === selectedRouteId
  );

  const filteredRoutes =
    statusFilter === "all"
      ? routes
      : routes.filter((r) => r.status === statusFilter);

  const handleExportJSON = () => {
    if (!selectedRoute) return;
    const content = generateJSONReport(
      selectedRoute,
      orders,
      locations,
      routeExceptions
    );
    downloadFile(
      content,
      `picking-route-${selectedRoute.id}.json`,
      "application/json"
    );
  };

  const handleExportCSV = () => {
    if (!selectedRoute) return;
    const content = generateCSVReport(
      selectedRoute,
      orders,
      locations,
      routeExceptions
    );
    downloadFile(
      content,
      `picking-route-${selectedRoute.id}.csv`,
      "text/csv;charset=utf-8"
    );
  };

  const handleSaveNotes = () => {
    if (!selectedRoute) return;
    updateRoute(selectedRoute.id, { notes: notesText });
    setEditingNotes(null);
  };

  const getExceptionColor = (type: ExceptionType) => {
    switch (type) {
      case "duplicate_location":
        return "border-industrial-red bg-industrial-red/10";
      case "cold_chain_timeout":
        return "border-industrial-blue bg-industrial-blue/10";
      case "path_backtrack":
        return "border-industrial-amber bg-industrial-amber/10";
    }
  };

  const getExceptionIconColor = (type: ExceptionType) => {
    switch (type) {
      case "duplicate_location":
        return "text-industrial-red";
      case "cold_chain_timeout":
        return "text-industrial-blue";
      case "path_backtrack":
        return "text-industrial-amber";
    }
  };

  return (
    <div className="flex h-full gap-6 overflow-hidden">
      <div className="flex w-80 flex-col overflow-hidden rounded-xl border border-navy-700/50 bg-navy-800/50">
        <div className="border-b border-navy-700/50 px-5 py-3">
          <h3 className="text-sm font-medium text-gray-200">路线列表</h3>
          <div className="mt-3 flex flex-wrap gap-1">
            {(["all", "stored", "confirmed", "rejected"] as const).map(
              (s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                    statusFilter === s
                      ? "bg-navy-600 text-industrial-orange"
                      : "text-gray-400 hover:bg-navy-700"
                  }`}
                >
                  {s === "all" ? "全部" : STATUS_LABELS[s]}
                </button>
              )
            )}
          </div>
        </div>

        <div className="flex-1 overflow-auto p-3">
          {filteredRoutes.length > 0 ? (
            <div className="space-y-2">
              {filteredRoutes.map((route) => (
                <button
                  key={route.id}
                  onClick={() => setSelectedRouteId(route.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-all ${
                    selectedRouteId === route.id
                      ? "border-industrial-orange bg-industrial-orange/10"
                      : "border-navy-700/50 bg-navy-900/50 hover:border-navy-600"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-200">
                      {route.name}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium status-${route.status}`}
                    >
                      {STATUS_LABELS[route.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{route.stops.length} 站点</span>
                    <span>{route.totalDistance} 距离</span>
                    <span>{route.estimatedMinutes} 分钟</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-gray-500">
              <AlertTriangle size={32} className="mb-2 opacity-30" />
              <p className="text-xs">暂无路线</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {selectedRoute ? (
          <>
            <div className="mb-4 flex items-center justify-between rounded-xl border border-navy-700/50 bg-navy-800/50 px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-gray-100">
                  {selectedRoute.name}
                </h2>
                <div className="mt-1 flex items-center gap-4 text-xs text-gray-500">
                  <span>
                    总距离:{" "}
                    <span className="font-mono text-gray-300">
                      {selectedRoute.totalDistance}
                    </span>
                  </span>
                  <span>
                    预计耗时:{" "}
                    <span className="font-mono text-gray-300">
                      {selectedRoute.estimatedMinutes} 分钟
                    </span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex gap-1 rounded-lg bg-navy-900 p-1">
                  <button
                    onClick={() => updateRouteStatus(selectedRoute.id, "stored")}
                    className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                      selectedRoute.status === "stored"
                        ? "bg-industrial-amber/20 text-industrial-amber"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    暂存
                  </button>
                  <button
                    onClick={() =>
                      updateRouteStatus(selectedRoute.id, "confirmed")
                    }
                    className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                      selectedRoute.status === "confirmed"
                        ? "bg-industrial-green/20 text-industrial-green"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    确认
                  </button>
                  <button
                    onClick={() =>
                      updateRouteStatus(selectedRoute.id, "rejected")
                    }
                    className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                      selectedRoute.status === "rejected"
                        ? "bg-industrial-red/20 text-industrial-red"
                        : "text-gray-400 hover:text-gray-200"
                    }`}
                  >
                    退回
                  </button>
                </div>

                <button
                  onClick={handleExportJSON}
                  className="flex items-center gap-1 rounded-md bg-navy-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-navy-600"
                >
                  <FileJson size={14} />
                  <span>JSON</span>
                </button>
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1 rounded-md bg-navy-700 px-3 py-1.5 text-xs text-gray-300 hover:bg-navy-600"
                >
                  <FileSpreadsheet size={14} />
                  <span>CSV</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto space-y-4">
              <div className="rounded-xl border border-navy-700/50 bg-navy-800/50 p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-200 flex items-center gap-2">
                    <StickyNote size={16} className="text-industrial-orange" />
                    人工备注
                  </h3>
                  {editingNotes !== selectedRoute.id ? (
                    <button
                      onClick={() => {
                        setEditingNotes(selectedRoute.id);
                        setNotesText(selectedRoute.notes);
                      }}
                      className="text-xs text-industrial-orange hover:underline"
                    >
                      编辑备注
                    </button>
                  ) : (
                    <button
                      onClick={handleSaveNotes}
                      className="text-xs text-industrial-green hover:underline"
                    >
                      保存
                    </button>
                  )}
                </div>
                {editingNotes === selectedRoute.id ? (
                  <textarea
                    value={notesText}
                    onChange={(e) => setNotesText(e.target.value)}
                    className="w-full rounded-md border border-navy-600 bg-navy-900 px-3 py-2 text-sm text-gray-200 focus:border-industrial-orange focus:outline-none"
                    rows={3}
                    placeholder="添加备注..."
                    autoFocus
                  />
                ) : (
                  <p className="text-sm text-gray-400">
                    {selectedRoute.notes || "暂无备注"}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-navy-700/50 bg-navy-800/50 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-200 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-industrial-amber" />
                    异常检测结果
                    <span className="rounded-full bg-navy-700 px-2 py-0.5 text-xs">
                      {routeExceptions.filter((e) => !e.resolved).length} / {routeExceptions.length}
                    </span>
                  </h3>
                </div>

                {routeExceptions.length > 0 ? (
                  <div className="space-y-3">
                    {routeExceptions.map((e) => (
                      <div
                        key={e.id}
                        className={`rounded-lg border p-4 ${
                          e.resolved
                            ? "border-navy-700/50 bg-navy-900/30 opacity-60"
                            : getExceptionColor(e.type)
                        }`}
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${getExceptionIconColor(e.type)}`}
                            >
                              {EXCEPTION_LABELS[e.type]}
                            </span>
                            {e.resolved && (
                              <span className="rounded-full bg-industrial-green/20 px-2 py-0.5 text-xs text-industrial-green">
                                已解决
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              updateException(e.id, { resolved: !e.resolved })
                            }
                            className={`p-1 rounded transition-colors ${
                              e.resolved
                                ? "text-industrial-green hover:bg-industrial-green/10"
                                : "text-gray-500 hover:text-industrial-green"
                            }`}
                          >
                            {e.resolved ? <X size={14} /> : <Check size={14} />}
                          </button>
                        </div>
                        <p className="text-sm text-gray-300">{e.message}</p>
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-400">
                            查看详情
                          </summary>
                          <pre className="mt-2 rounded-md bg-navy-900/50 p-2 text-xs text-gray-500 font-mono overflow-x-auto">
                            {e.detail}
                          </pre>
                        </details>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                    <Check size={40} className="mb-2 opacity-30" />
                    <p className="text-sm">暂无异常</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center rounded-xl border border-navy-700/50 bg-navy-800/30 text-gray-500">
            <Download size={48} className="mb-3 opacity-30" />
            <p className="text-sm">从左侧选择一个路线查看详情</p>
          </div>
        )}
      </div>
    </div>
  );
}
