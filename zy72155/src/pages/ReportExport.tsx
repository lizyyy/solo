import { useState, useMemo } from "react";
import { Download, FileText, Check, Clock, Eye } from "lucide-react";
import { useStore } from "@/store";
import { STATUS_LABELS, PointStatus } from "@/types";

const STATUS_OPTIONS: PointStatus[] = ["processed", "pending", "field_review"];

const STATUS_ICONS: Record<PointStatus, React.ElementType> = {
  processed: Check,
  pending: Clock,
  field_review: Eye,
};

const STATUS_COLORS: Record<PointStatus, string> = {
  processed: "#10b981",
  pending: "#f59e0b",
  field_review: "#FF6B35",
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function ReportExport() {
  const points = useStore((s) => s.points);
  const feedbacks = useStore((s) => s.feedbacks);
  const aliases = useStore((s) => s.aliases);
  const judgments = useStore((s) => s.judgments);
  const plans = useStore((s) => s.plans);

  const [checkedStatuses, setCheckedStatuses] = useState<Set<PointStatus>>(
    () => new Set(STATUS_OPTIONS)
  );

  const toggleStatus = (status: PointStatus) => {
    setCheckedStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  };

  const feedbackCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const fb of feedbacks) {
      map[fb.pointId] = (map[fb.pointId] || 0) + 1;
    }
    return map;
  }, [feedbacks]);

  const aliasesByPoint = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const a of aliases) {
      if (!map[a.pointId]) map[a.pointId] = [];
      map[a.pointId].push(a.alias);
    }
    return map;
  }, [aliases]);

  const latestJudgmentByPoint = useMemo(() => {
    const map: Record<string, { reason: string; operator: string; createdAt: string }> = {};
    const sorted = [...judgments].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    for (const j of sorted) {
      if (!map[j.pointId]) {
        map[j.pointId] = { reason: j.reason, operator: j.operator, createdAt: j.createdAt };
      }
    }
    return map;
  }, [judgments]);

  const latestPlanByPoint = useMemo(() => {
    const map: Record<string, number> = {};
    const sorted = [...plans].sort((a, b) => b.versionNumber - a.versionNumber);
    for (const p of sorted) {
      if (!map[p.pointId]) {
        map[p.pointId] = p.versionNumber;
      }
    }
    return map;
  }, [plans]);

  const filteredPoints = useMemo(
    () => points.filter((p) => checkedStatuses.has(p.status)),
    [points, checkedStatuses]
  );

  const statusCounts = useMemo(() => {
    const map: Record<PointStatus, number> = { processed: 0, pending: 0, field_review: 0 };
    for (const p of points) {
      map[p.status]++;
    }
    return map;
  }, [points]);

  const handleExportCSV = () => {
    const headers = [
      "点位标准名",
      "别名",
      "关联学校",
      "当前状态",
      "反馈数",
      "判断依据",
      "最近操作人",
      "最近操作时间",
      "方案版本",
    ];
    const rows = filteredPoints.map((p) => {
      const j = latestJudgmentByPoint[p.id];
      return [
        p.standardName || "（空）",
        (aliasesByPoint[p.id] || []).join("、"),
        p.schoolName,
        STATUS_LABELS[p.status],
        String(feedbackCounts[p.id] || 0),
        j?.reason || "—",
        j?.operator || "—",
        j ? formatDateTime(j.createdAt) : "—",
        latestPlanByPoint[p.id] != null ? `v${latestPlanByPoint[p.id]}` : "—",
      ];
    });
    const csvContent = [headers, ...rows].map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `安全点位报告_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "#f8fafb" }}>
      <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ backgroundColor: "#1A535C" }}
            >
              <FileText size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">报告导出</h1>
              <p className="text-xs text-gray-500">按状态筛选并导出安全点位报告</p>
            </div>
          </div>
          <button
            onClick={handleExportCSV}
            disabled={filteredPoints.length === 0}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#FF6B35" }}
          >
            <Download size={16} />
            导出 CSV
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-6 py-5">
        <div className="mb-5 flex gap-4">
          {STATUS_OPTIONS.map((status) => {
            const Icon = STATUS_ICONS[status];
            const count = statusCounts[status];
            const checked = checkedStatuses.has(status);
            return (
              <label
                key={status}
                className="flex flex-1 cursor-pointer items-center gap-3 rounded-xl border bg-white p-4 transition-shadow hover:shadow-sm"
                style={{
                  borderColor: checked ? STATUS_COLORS[status] : "#e5e7eb",
                  borderWidth: checked ? 2 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleStatus(status)}
                  className="h-4 w-4 rounded border-gray-300"
                  style={{ accentColor: STATUS_COLORS[status] }}
                />
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${STATUS_COLORS[status]}15` }}
                >
                  <Icon size={16} style={{ color: STATUS_COLORS[status] }} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-800">{STATUS_LABELS[status]}</div>
                  <div className="text-xs text-gray-500">{count} 个点位</div>
                </div>
              </label>
            );
          })}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <Eye size={16} style={{ color: "#1A535C" }} />
              <span className="text-sm font-semibold text-gray-800">预览数据</span>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ backgroundColor: "#1A535C15", color: "#1A535C" }}
              >
                {filteredPoints.length} 条
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100" style={{ backgroundColor: "#f8fafb" }}>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">点位标准名</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">别名</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">关联学校</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">当前状态</th>
                  <th className="px-4 py-2.5 text-center font-medium text-gray-600">反馈数</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">判断依据</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">最近操作人</th>
                  <th className="px-4 py-2.5 text-left font-medium text-gray-600">最近操作时间</th>
                  <th className="px-4 py-2.5 text-center font-medium text-gray-600">方案版本</th>
                </tr>
              </thead>
              <tbody>
                {filteredPoints.map((p) => {
                  const j = latestJudgmentByPoint[p.id];
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 text-gray-900 font-medium">
                        {p.standardName || "（空）"}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">
                        {(aliasesByPoint[p.id] || []).join("、") || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{p.schoolName || "—"}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: `${STATUS_COLORS[p.status]}18`,
                            color: STATUS_COLORS[p.status],
                          }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: STATUS_COLORS[p.status] }}
                          />
                          {STATUS_LABELS[p.status]}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-700">
                        {feedbackCounts[p.id] || 0}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 max-w-[200px] truncate">
                        {j?.reason || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{j?.operator || "—"}</td>
                      <td className="px-4 py-2.5 text-gray-500 text-xs whitespace-nowrap">
                        {j ? formatDateTime(j.createdAt) : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-center text-gray-700">
                        {latestPlanByPoint[p.id] != null ? `v${latestPlanByPoint[p.id]}` : "—"}
                      </td>
                    </tr>
                  );
                })}
                {filteredPoints.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                      没有匹配的点位数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
