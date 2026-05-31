import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";
import {
  CheckCircle2,
  Clock,
  Shield,
  FileDown,
  AlertTriangle,
  FileJson,
  FileSpreadsheet,
} from "lucide-react";
import {
  exportEventsToJSON,
  exportEventsToCSV,
  exportBriefingToPDF,
} from "@/utils/export";
import { formatTime, formatDuration } from "@/utils/timeFormat";
import type { OcclusionEvent } from "@/types";

export default function Briefing() {
  const {
    occlusionEvents,
    missingFrameAlerts,
    reviewRecords,
    reviewHistory,
    loadData,
  } = useAppStore();

  useEffect(() => {
    loadData();
  }, [loadData]);

  const [activeTab, setActiveTab] = useState<"confirmed" | "pending" | "modified">("confirmed");

  const confirmed = occlusionEvents.filter((e) => e.status === "confirmed");
  const pending = occlusionEvents.filter((e) => e.status === "pending");
  const modified = occlusionEvents.filter((e) => e.status === "modified");

  const tabs = [
    {
      key: "confirmed" as const,
      label: "已确认",
      items: confirmed,
      icon: CheckCircle2,
      color: "emerald",
      emptyText: "暂无已确认记录",
    },
    {
      key: "pending" as const,
      label: "待补",
      items: pending,
      icon: Clock,
      color: "amber",
      emptyText: "暂无待补记录",
    },
    {
      key: "modified" as const,
      label: "人工改过",
      items: modified,
      icon: Shield,
      color: "blue",
      emptyText: "暂无人工修改记录",
    },
  ];

  const currentTab = tabs.find((t) => t.key === activeTab)!;

  const renderCard = (evt: OcclusionEvent) => {
    const alerts = missingFrameAlerts.filter(
      (a) => a.occlusionEventId === evt.id
    );
    const records = reviewRecords.filter(
      (r) => r.occlusionEventId === evt.id
    );

    return (
      <div
        key={evt.id}
        className="rounded-lg border border-slate-700/30 bg-[#0f1a2e] p-4"
      >
        <div className="flex items-center gap-2 mb-2">
          <span className="font-mono text-xs text-slate-400">
            {formatTime(evt.startTime)} — {formatTime(evt.endTime)}
          </span>
          <span className="text-[10px] text-slate-600">
            {formatDuration(evt.startTime, evt.endTime)}
          </span>
        </div>

        <p className="text-xs text-slate-300 mb-3 leading-relaxed">
          {evt.reason}
        </p>

        <div className="rounded border border-amber-400/15 bg-amber-400/5 px-3 py-2 mb-3">
          <p className="text-[10px] text-amber-400/70 mb-0.5">处理口径</p>
          <p className="text-xs text-slate-300">{evt.handlingGuideline}</p>
        </div>

        {alerts.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-1.5 text-[11px]"
              >
                <AlertTriangle className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span
                    className={`px-1 py-0.5 rounded text-[9px] mr-1 ${
                      alert.source === "orbital_elements"
                        ? "bg-blue-400/10 text-blue-400"
                        : "bg-violet-400/10 text-violet-400"
                    }`}
                  >
                    {alert.source === "orbital_elements"
                      ? "轨道根数"
                      : "遥测片段"}
                  </span>
                  <span className="text-slate-400">{alert.description}</span>
                  <p className="text-amber-400/70 mt-0.5">
                    → {alert.nextStep}（{alert.responsible}）
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {records.length > 0 && (
          <div className="border-t border-slate-700/20 pt-2">
            <p className="text-[10px] text-slate-500 mb-1">复核记录</p>
            {records.map((rec) => (
              <p key={rec.id} className="text-[10px] text-slate-500">
                {rec.reviewer} · {formatTime(rec.reviewedAt)} ·{" "}
                {rec.status === "confirmed"
                  ? "确认"
                  : rec.status === "modified"
                  ? "修正"
                  : "待补"}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  };

  const handleExportJSON = () => exportEventsToJSON(occlusionEvents);
  const handleExportCSV = () => exportEventsToCSV(occlusionEvents);
  const handleExportPDF = async () => {
    await exportBriefingToPDF(
      occlusionEvents,
      missingFrameAlerts,
      reviewRecords,
      reviewHistory
    );
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">任务简报</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              已确认 / 待补 / 人工改过 · 分栏展示 · 含处理口径
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <FileDown className="w-3.5 h-3.5" />
              PDF
            </button>
            <button
              onClick={handleExportJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <FileJson className="w-3.5 h-3.5" />
              JSON
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              CSV
            </button>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-700/30 px-6">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                activeTab === tab.key
                  ? tab.color === "emerald"
                    ? "text-emerald-400 border-emerald-400"
                    : tab.color === "amber"
                    ? "text-amber-400 border-amber-400"
                    : "text-blue-400 border-blue-400"
                  : "text-slate-500 border-transparent hover:text-slate-300"
              }`}
            >
              <tab.icon className="w-3.5 h-3.5 inline mr-1.5" />
              {tab.label}
              <span className="ml-1.5 text-[10px] opacity-60">
                ({tab.items.length})
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {currentTab.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <currentTab.icon className="w-8 h-8 mb-2 text-slate-600" />
            <p className="text-sm">{currentTab.emptyText}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {currentTab.items.map(renderCard)}
          </div>
        )}
      </div>
    </div>
  );
}
