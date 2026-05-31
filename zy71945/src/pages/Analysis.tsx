import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import {
  Search,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Shield,
  Info,
} from "lucide-react";
import { formatTime, formatDuration } from "@/utils/timeFormat";
import type { OcclusionEvent, MissingFrameAlert } from "@/types";

export default function Analysis() {
  const {
    occlusionEvents,
    missingFrameAlerts,
    isAnalyzing,
    runAnalysis,
    loadData,
  } = useAppStore();

  const [selectedEvent, setSelectedEvent] = useState<OcclusionEvent | null>(null);
  const [selectedAlerts, setSelectedAlerts] = useState<MissingFrameAlert[]>([]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRun = async () => {
    await runAnalysis();
  };

  const handleSelectEvent = (event: OcclusionEvent) => {
    setSelectedEvent(event);
    const alerts = missingFrameAlerts.filter(
      (a) => a.occlusionEventId === event.id
    );
    setSelectedAlerts(alerts);
  };

  const confidenceColor = (c: string) => {
    if (c === "high") return "text-emerald-400";
    if (c === "medium") return "text-amber-400";
    return "text-red-400";
  };

  const confidenceLabel = (c: string) => {
    if (c === "high") return "高";
    if (c === "medium") return "中";
    return "低";
  };

  const statusIcon = (s: string) => {
    if (s === "confirmed") return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />;
    if (s === "modified") return <Shield className="w-3.5 h-3.5 text-blue-400" />;
    return <Clock className="w-3.5 h-3.5 text-amber-400" />;
  };

  const dataSourceLabel = (ds: string) => {
    if (ds === "orbital") return "轨道根数";
    if (ds === "telemetry") return "遥测片段";
    return "轨道+遥测";
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">星敏感器遮挡分析</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            自动判断遮挡事件 · 判断理由可查 · 缺帧溯源
          </p>
        </div>
        <button
          onClick={handleRun}
          disabled={isAnalyzing}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-amber-400 text-slate-900 text-sm font-medium hover:bg-amber-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Search className="w-4 h-4" />
          {isAnalyzing ? "分析中…" : "运行分析"}
        </button>
      </div>

      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-auto px-6 py-4">
          {occlusionEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Search className="w-10 h-10 mb-3 text-slate-600" />
              <p className="text-sm">尚无分析结果</p>
              <p className="text-xs mt-1">请先导入数据后点击「运行分析」</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-700/30">
                  <th className="pb-2 font-medium">状态</th>
                  <th className="pb-2 font-medium">遮挡区间</th>
                  <th className="pb-2 font-medium">时长</th>
                  <th className="pb-2 font-medium">数据来源</th>
                  <th className="pb-2 font-medium">置信度</th>
                  <th className="pb-2 font-medium">判断理由</th>
                  <th className="pb-2 font-medium">缺帧</th>
                  <th className="pb-2 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/20">
                {occlusionEvents.map((evt) => {
                  const alerts = missingFrameAlerts.filter(
                    (a) => a.occlusionEventId === evt.id
                  );
                  return (
                    <tr
                      key={evt.id}
                      className={`hover:bg-slate-800/30 cursor-pointer ${
                        selectedEvent?.id === evt.id ? "bg-amber-400/5" : ""
                      }`}
                      onClick={() => handleSelectEvent(evt)}
                    >
                      <td className="py-2.5">{statusIcon(evt.status)}</td>
                      <td className="py-2.5 font-mono text-xs">
                        {formatTime(evt.startTime)}
                      </td>
                      <td className="py-2.5 text-xs text-slate-400">
                        {formatDuration(evt.startTime, evt.endTime)}
                      </td>
                      <td className="py-2.5 text-xs">
                        {dataSourceLabel(evt.dataSource)}
                      </td>
                      <td className={`py-2.5 text-xs font-medium ${confidenceColor(evt.confidence)}`}>
                        {confidenceLabel(evt.confidence)}
                      </td>
                      <td className="py-2.5 text-xs text-slate-400 max-w-xs truncate">
                        {evt.reason.slice(0, 40)}…
                      </td>
                      <td className="py-2.5">
                        {alerts.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-red-400/10 text-red-400">
                            <AlertTriangle className="w-3 h-3" />
                            {alerts.length}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-2.5">
                        <ChevronRight className="w-4 h-4 text-slate-600" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {selectedEvent && (
          <div className="w-96 flex-shrink-0 border-l border-slate-700/50 bg-[#0a1120] overflow-auto">
            <div className="px-4 py-4 border-b border-slate-700/30">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-slate-200">判断理由</h3>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-xs text-slate-500 hover:text-slate-300"
                >
                  关闭
                </button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs text-slate-500 mb-1">遮挡区间</p>
                <p className="text-sm font-mono text-slate-200">
                  {formatTime(selectedEvent.startTime)} — {formatTime(selectedEvent.endTime)}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  持续 {formatDuration(selectedEvent.startTime, selectedEvent.endTime)}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500 mb-1">判断依据</p>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {selectedEvent.reason}
                </p>
              </div>

              <div className="flex gap-4">
                <div>
                  <p className="text-xs text-slate-500 mb-1">数据来源</p>
                  <p className="text-sm text-slate-200">
                    {dataSourceLabel(selectedEvent.dataSource)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 mb-1">置信度</p>
                  <p className={`text-sm font-medium ${confidenceColor(selectedEvent.confidence)}`}>
                    {confidenceLabel(selectedEvent.confidence)}
                  </p>
                </div>
              </div>

              <div className="rounded border border-amber-400/20 bg-amber-400/5 p-3">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-amber-300 mb-1">处理口径</p>
                    <p className="text-xs text-slate-300">
                      {selectedEvent.handlingGuideline}
                    </p>
                  </div>
                </div>
              </div>

              {selectedAlerts.length > 0 && (
                <div>
                  <p className="text-xs text-slate-500 mb-2">缺帧溯源</p>
                  <div className="space-y-2">
                    {selectedAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="rounded border border-red-400/20 bg-red-400/5 p-3"
                      >
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded ${
                                  alert.source === "orbital_elements"
                                    ? "bg-blue-400/10 text-blue-400"
                                    : "bg-violet-400/10 text-violet-400"
                                }`}
                              >
                                {alert.source === "orbital_elements"
                                  ? "来自轨道根数"
                                  : "来自遥测片段"}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 mb-1">
                              {alert.description}
                            </p>
                            <p className="text-xs text-amber-400/80">
                              下一步：{alert.nextStep}
                            </p>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              联系：{alert.responsible}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
