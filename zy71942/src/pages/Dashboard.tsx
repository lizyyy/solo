import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Clock, ArrowRight, FileUp, FlaskConical } from "lucide-react";
import { useStore } from "@/store/useStore";
import { formatConflictType } from "@/utils/humanMessage";
import type { ConflictType } from "@/types";

const STAT_CARDS: {
  type: ConflictType;
  accent: string;
  accentBg: string;
  iconBg: string;
}[] = [
  {
    type: "window_overlap",
    accent: "text-blue-400",
    accentBg: "border-blue-500/30",
    iconBg: "bg-blue-500/10",
  },
  {
    type: "telemetry_frame_drop",
    accent: "text-emerald-400",
    accentBg: "border-emerald-500/30",
    iconBg: "bg-emerald-500/10",
  },
  {
    type: "time_system_mixed",
    accent: "text-violet-400",
    accentBg: "border-violet-500/30",
    iconBg: "bg-violet-500/10",
  },
];

export default function Dashboard() {
  const conflicts = useStore((s) => s.conflicts);
  const versionDiffs = useStore((s) => s.versionDiffs);
  const importHistory = useStore((s) => s.importHistory);
  const importPayloadPlan = useStore((s) => s.importPayloadPlan);
  const importGroundStationSchedule = useStore((s) => s.importGroundStationSchedule);

  const loadDemoData = () => {
    const demoPayload = JSON.stringify({
      windows: [
        { id: "w1", stationName: "喀什站", startTime: "2026-06-01T08:00:00Z", endTime: "2026-06-01T09:30:00Z", timeSystem: "UTC", description: "卫星A过境" },
        { id: "w2", stationName: "喀什站", startTime: "2026-06-01T09:00:00Z", endTime: "2026-06-01T10:30:00Z", timeSystem: "UTC", description: "卫星B过境" },
        { id: "w3", stationName: "文昌站", startTime: "2026-06-01T10:00:00Z", endTime: "2026-06-01T11:00:00Z", timeSystem: "BJT", description: "卫星C测控" },
        { id: "w4", stationName: "渭南站", startTime: "2026-06-01T12:00:00Z", endTime: "2026-06-01T13:00:00Z", timeSystem: "UTC", description: "卫星D数传" }
      ],
      telemetrySegments: [
        { id: "t1", stationName: "喀什站", startTime: "2026-06-01T08:00:00Z", endTime: "2026-06-01T09:30:00Z", timeSystem: "UTC", expectedFrames: 900, actualFrames: 876 },
        { id: "t2", stationName: "文昌站", startTime: "2026-06-01T10:00:00Z", endTime: "2026-06-01T11:00:00Z", timeSystem: "UTC", expectedFrames: 600, actualFrames: 600 }
      ]
    });
    const demoSchedule = JSON.stringify({
      windows: [
        { id: "gs1", stationName: "喀什站", startTime: "2026-06-01T07:30:00Z", endTime: "2026-06-01T08:45:00Z", timeSystem: "UTC", description: "日常调度窗口" },
        { id: "gs2", stationName: "渭南站", startTime: "2026-06-01T12:00:00Z", endTime: "2026-06-01T14:00:00Z", timeSystem: "UTC", description: "应急数传窗口" }
      ]
    });
    importPayloadPlan(demoPayload, "演示载荷计划.json", "系统");
    importGroundStationSchedule(demoSchedule, "演示地面站调度.json", "系统");
  };

  const stats = useMemo(() => {
    const result: Record<ConflictType, { total: number; pending: number }> = {
      window_overlap: { total: 0, pending: 0 },
      telemetry_frame_drop: { total: 0, pending: 0 },
      time_system_mixed: { total: 0, pending: 0 },
    };
    for (const c of conflicts) {
      result[c.type].total++;
      if (c.status === "pending") {
        result[c.type].pending++;
      }
    }
    return result;
  }, [conflicts]);

  const pendingCount = useMemo(
    () => conflicts.filter((c) => c.status === "pending").length,
    [conflicts]
  );

  const recentImports = useMemo(
    () => [...importHistory].sort((a, b) => b.importedAt.localeCompare(a.importedAt)).slice(0, 5),
    [importHistory]
  );

  const recentDiffs = useMemo(
    () => [...versionDiffs].slice(-5).reverse(),
    [versionDiffs]
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-50">冲突总览</h1>
        <p className="mt-1 text-sm text-slate-400">
          实时监控地面站资源冲突状态，快速定位待处理问题
        </p>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {STAT_CARDS.map((card) => {
          const s = stats[card.type];
          return (
            <div
              key={card.type}
              className={`bg-slate-900 border ${card.accentBg} rounded-lg p-5 transition-shadow hover:shadow-lg hover:shadow-slate-900/50`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-medium ${card.accent} uppercase tracking-wider`}>
                  {formatConflictType(card.type)}
                </span>
                <div className={`w-8 h-8 rounded-md ${card.iconBg} flex items-center justify-center`}>
                  <AlertTriangle className={`w-4 h-4 ${card.accent}`} />
                </div>
              </div>
              <div className="flex items-end gap-3">
                <span className="text-3xl font-bold text-slate-50">{s.total}</span>
                {s.pending > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-xs font-medium mb-1">
                    {s.pending} 待确认
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {pendingCount > 0 && (
        <Link
          to="/conflicts?status=pending"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-amber-600 text-white text-sm font-medium hover:bg-amber-500 transition-colors"
        >
          <AlertTriangle className="w-4 h-4" />
          处理待确认冲突（{pendingCount}）
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}

      {recentDiffs.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg">
          <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">版本变更通知</h2>
            <Link
              to="/versions"
              className="text-xs text-slate-500 hover:text-amber-400 transition-colors flex items-center gap-1"
            >
              查看全部 <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <ul className="divide-y divide-slate-800/60">
            {recentDiffs.map((diff) => (
              <li key={diff.id} className="px-5 py-3">
                <p className="text-sm text-slate-300">{diff.summary}</p>
                <p className="text-xs text-slate-600 mt-1">
                  {diff.oldVersion} → {diff.newVersion}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {recentImports.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg">
          <div className="px-5 py-3 border-b border-slate-800">
            <h2 className="text-sm font-semibold text-slate-200">最近导入记录</h2>
          </div>
          <ul className="divide-y divide-slate-800/60">
            {recentImports.map((entry, idx) => (
              <li key={entry.id} className="px-5 py-3 flex items-start gap-3">
                <div className="mt-0.5 flex flex-col items-center">
                  <div className={`w-2 h-2 rounded-full ${entry.retracted ? "bg-slate-700" : "bg-amber-500"}`} />
                  {idx < recentImports.length - 1 && (
                    <div className="w-px h-6 bg-slate-800 mt-1" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${entry.retracted ? "text-slate-600 line-through" : "text-slate-300"}`}>
                    {entry.filename}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500">
                      {entry.type === "payload_plan" ? "载荷计划" : "站调度表"}
                    </span>
                    <span className="text-xs text-slate-700">·</span>
                    <span className="text-xs text-slate-600 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(entry.importedAt).toLocaleString("zh-CN")}
                    </span>
                  </div>
                </div>
                {entry.retracted && (
                  <span className="text-xs text-slate-600 shrink-0">已撤回</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {conflicts.length === 0 && importHistory.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-600">
          <FileUp className="w-12 h-12 mb-3" />
          <p className="text-sm mb-4">暂无数据，请先导入载荷计划或站调度表</p>
          <button
            onClick={loadDemoData}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition-colors border border-slate-700"
          >
            <FlaskConical className="w-4 h-4" />
            加载演示数据
          </button>
        </div>
      )}
    </div>
  );
}
