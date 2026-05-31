import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle, Clock, Search, RotateCcw } from "lucide-react";
import { useAppStore } from "@/store";
import type { AnomalyTag, SortieStatus } from "@/types";

const ANOMALY_CONFIG: Record<AnomalyTag, { label: string; color: string; border: string; bg: string }> = {
  battery_cycle_error: { label: "电池循环错算", color: "text-red-400", border: "border-red-400/40", bg: "bg-red-400/10" },
  nofly_zone_edge: { label: "禁飞区擦边", color: "text-orange-400", border: "border-orange-400/40", bg: "bg-orange-400/10" },
  rth_point_lost: { label: "返航点丢失", color: "text-blue-400", border: "border-blue-400/40", bg: "bg-blue-400/10" },
  other: { label: "其他", color: "text-gray-400", border: "border-gray-400/40", bg: "bg-gray-400/10" },
};

const STATUS_CONFIG: Record<SortieStatus, { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
  normal: { label: "正常", color: "text-emerald-400", bg: "bg-emerald-500/15", icon: CheckCircle },
  pending: { label: "待确认", color: "text-amber-400", bg: "bg-amber-500/15", icon: Clock },
  abnormal: { label: "异常", color: "text-red-400", bg: "bg-red-500/15", icon: AlertTriangle },
};

function FilterBar() {
  const { filters, setFilters, resetFilters } = useAppStore();

  const toggleAnomaly = (tag: AnomalyTag) => {
    const next = filters.anomalyTags.includes(tag)
      ? filters.anomalyTags.filter((t) => t !== tag)
      : [...filters.anomalyTags, tag];
    setFilters({ anomalyTags: next });
  };

  const toggleStatus = (s: SortieStatus) => {
    const next = filters.status.includes(s)
      ? filters.status.filter((x) => x !== s)
      : [...filters.status, s];
    setFilters({ status: next });
  };

  return (
    <div className="sticky top-0 z-10 mb-4 rounded-lg bg-[#16213e] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Search className="mr-1 h-4 w-4 text-gray-500" />
        <span className="text-xs font-medium text-gray-400">异常标签:</span>
        {(Object.keys(ANOMALY_CONFIG) as AnomalyTag[]).map((tag) => {
          const cfg = ANOMALY_CONFIG[tag];
          const active = filters.anomalyTags.includes(tag);
          return (
            <button
              key={tag}
              onClick={() => toggleAnomaly(tag)}
              className={`rounded-full border px-2 py-0.5 text-xs font-medium transition-colors ${
                active ? `${cfg.bg} ${cfg.border} ${cfg.color}` : "border-white/10 text-gray-500 hover:text-gray-300"
              }`}
            >
              {cfg.label}
            </button>
          );
        })}

        <span className="mx-2 h-4 w-px bg-white/10" />

        <span className="text-xs font-medium text-gray-400">状态:</span>
        {(Object.keys(STATUS_CONFIG) as SortieStatus[]).map((s) => {
          const cfg = STATUS_CONFIG[s];
          const Icon = cfg.icon;
          const active = filters.status.includes(s);
          return (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                active ? `${cfg.bg} ${cfg.color}` : "text-gray-500 hover:text-gray-300"
              }`}
            >
              <Icon className="h-3 w-3" />
              {cfg.label}
            </button>
          );
        })}

        <button
          onClick={resetFilters}
          className="ml-auto flex items-center gap-1 rounded px-2 py-0.5 text-xs text-gray-500 transition-colors hover:text-gray-300"
        >
          <RotateCcw className="h-3 w-3" />
          重置
        </button>
      </div>
    </div>
  );
}

function formatTs(ts: number) {
  return new Date(ts).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Home() {
  const navigate = useNavigate();
  const { sorties, filters } = useAppStore();

  const filtered = useMemo(() => {
    return sorties.filter((s) => {
      if (filters.status.length > 0 && !filters.status.includes(s.status)) return false;
      if (filters.anomalyTags.length > 0 && !filters.anomalyTags.some((t) => s.anomalyTags.includes(t))) return false;
      return true;
    });
  }, [sorties, filters]);

  return (
    <div className="min-h-screen bg-[#0f0f23]">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">换电总览</h1>
          <p className="mt-1 text-sm text-gray-500">
            共 {sorties.length} 条架次
            {filtered.length !== sorties.length && ` · 筛选后 ${filtered.length} 条`}
          </p>
        </div>
      </div>

      <FilterBar />

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-600">
          <Search className="mb-3 h-10 w-10" />
          <p className="text-sm">没有匹配的架次记录</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-white/5">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-[#16213e]/60">
                <th className="px-4 py-3 font-medium text-gray-400">架次编号</th>
                <th className="px-4 py-3 font-medium text-gray-400">电池编号</th>
                <th className="px-4 py-3 font-medium text-gray-400">时间</th>
                <th className="px-4 py-3 font-medium text-gray-400">换电结论</th>
                <th className="px-4 py-3 font-medium text-gray-400">异常标签</th>
                <th className="px-4 py-3 font-medium text-gray-400">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const sc = STATUS_CONFIG[s.status];
                return (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/evidence/${s.id}`)}
                    className="cursor-pointer border-b border-white/5 transition-colors hover:bg-white/5"
                  >
                    <td className="px-4 py-3 font-mono text-gray-200">{s.sortieNo}</td>
                    <td className="px-4 py-3 font-mono text-gray-300">{s.batteryId}</td>
                    <td className="px-4 py-3 text-gray-400">{formatTs(s.timestamp)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${sc.bg} ${sc.color}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {s.anomalyTags.length === 0 && <span className="text-xs text-gray-600">—</span>}
                        {s.anomalyTags.map((tag) => {
                          const cfg = ANOMALY_CONFIG[tag];
                          return (
                            <span key={tag} className={`rounded-full border px-2 py-0.5 text-xs ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/evidence/${s.id}`); }}
                        className="text-xs font-medium text-amber-400 transition-colors hover:text-amber-300"
                      >
                        查看证据链
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
