import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { GitMerge, Check, X, ArrowRight } from "lucide-react";
import { useStore } from "@/store";
import { StatusBadge } from "@/components/StatusBadge";

type TabKey = "pending" | "confirmed" | "rejected";

const TABS: { key: TabKey; label: string }[] = [
  { key: "pending", label: "待确认" },
  { key: "confirmed", label: "已确认" },
  { key: "rejected", label: "已拒绝" },
];

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function similarityColor(sim: number): string {
  if (sim >= 0.85) return "#10b981";
  if (sim >= 0.65) return "#f59e0b";
  return "#9ca3af";
}

export default function MergeManagement() {
  const points = useStore((s) => s.points);
  const feedbacks = useStore((s) => s.feedbacks);
  const merges = useStore((s) => s.merges);
  const resolveMerge = useStore((s) => s.resolveMerge);

  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [operatorInputs, setOperatorInputs] = useState<Record<string, string>>({});

  const feedbackCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const fb of feedbacks) {
      map[fb.pointId] = (map[fb.pointId] || 0) + 1;
    }
    return map;
  }, [feedbacks]);

  const filtered = useMemo(
    () => merges.filter((m) => m.status === activeTab),
    [merges, activeTab]
  );

  const handleResolve = (id: string, confirmed: boolean) => {
    const op = operatorInputs[id]?.trim();
    if (confirmed && !op) return;
    resolveMerge(id, confirmed, op || "匿名");
    setOperatorInputs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const tabCounts = useMemo(() => {
    const map: Record<TabKey, number> = { pending: 0, confirmed: 0, rejected: 0 };
    for (const m of merges) {
      map[m.status]++;
    }
    return map;
  }, [merges]);

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "#f8fafb" }}>
      <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-5xl">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-xl font-bold" style={{ color: "#1A535C" }}>
              <GitMerge size={22} />
              归并管理
            </h1>
            <span className="text-sm text-gray-500">
              共 {merges.length} 条归并建议
            </span>
          </div>
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors"
                style={
                  activeTab === tab.key
                    ? { backgroundColor: "#1A535C", color: "#fff" }
                    : { color: "#6b7280" }
                }
              >
                {tab.label}
                <span
                  className="ml-2 inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-semibold"
                  style={
                    activeTab === tab.key
                      ? { backgroundColor: "rgba(255,255,255,0.2)", color: "#fff" }
                      : { backgroundColor: "#e5e7eb", color: "#6b7280" }
                  }
                >
                  {tabCounts[tab.key]}
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-5xl p-6">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <GitMerge size={48} className="mb-3 text-gray-300" />
              <p className="text-sm">当前分类暂无归并建议</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((m) => {
                const sourcePoint = points.find((p) => p.id === m.sourcePointId);
                const targetPoint = points.find((p) => p.id === m.targetPointId);

                return (
                  <div
                    key={m.id}
                    className="rounded-lg border border-gray-200 bg-white p-5 transition-shadow hover:shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex flex-1 items-center gap-3 min-w-0">
                        <Link
                          to={`/point/${m.sourcePointId}`}
                          className="min-w-0 flex-1 rounded-lg border border-gray-100 bg-gray-50 p-3 transition-colors hover:bg-gray-100"
                        >
                          <div className="mb-1.5 flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-gray-900">
                              {sourcePoint?.standardName || "未知点位"}
                            </span>
                            {sourcePoint && <StatusBadge status={sourcePoint.status} />}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{feedbackCounts[m.sourcePointId] || 0} 条反馈</span>
                          </div>
                        </Link>

                        <div className="flex shrink-0 flex-col items-center gap-1">
                          <ArrowRight size={20} style={{ color: "#1A535C" }} />
                          <span
                            className="text-xs font-bold"
                            style={{ color: similarityColor(m.similarity) }}
                          >
                            {(m.similarity * 100).toFixed(1)}%
                          </span>
                        </div>

                        <Link
                          to={`/point/${m.targetPointId}`}
                          className="min-w-0 flex-1 rounded-lg border border-gray-100 bg-gray-50 p-3 transition-colors hover:bg-gray-100"
                        >
                          <div className="mb-1.5 flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-gray-900">
                              {targetPoint?.standardName || "未知点位"}
                            </span>
                            {targetPoint && <StatusBadge status={targetPoint.status} />}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{feedbackCounts[m.targetPointId] || 0} 条反馈</span>
                          </div>
                        </Link>
                      </div>
                    </div>

                    <div className="mt-4 border-t border-gray-100 pt-4">
                      {activeTab === "pending" ? (
                        <div className="flex items-center gap-3">
                          <input
                            type="text"
                            placeholder="操作人姓名"
                            value={operatorInputs[m.id] || ""}
                            onChange={(e) =>
                              setOperatorInputs((prev) => ({
                                ...prev,
                                [m.id]: e.target.value,
                              }))
                            }
                            className="w-36 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none transition-colors focus:border-[#1A535C] focus:bg-white"
                          />
                          <button
                            onClick={() => handleResolve(m.id, true)}
                            disabled={!operatorInputs[m.id]?.trim()}
                            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-40"
                            style={{ backgroundColor: "#10b981" }}
                          >
                            <Check size={14} />
                            确认归并
                          </button>
                          <button
                            onClick={() => handleResolve(m.id, false)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                          >
                            <X size={14} />
                            拒绝
                          </button>
                          <span className="ml-auto text-xs text-gray-400">
                            创建于 {formatDateTime(m.createdAt)}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            {m.status === "confirmed" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                                <Check size={12} />
                                已确认
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
                                <X size={12} />
                                已拒绝
                              </span>
                            )}
                            <span className="text-gray-600">
                              操作人：<span className="font-medium">{m.resolvedBy}</span>
                            </span>
                            {m.resolvedAt && (
                              <span className="text-gray-400">
                                {formatDateTime(m.resolvedAt)}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-400">
                            创建于 {formatDateTime(m.createdAt)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
