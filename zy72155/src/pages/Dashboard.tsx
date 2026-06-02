import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { MapPin, MessageSquare, Clock, Search, Filter } from "lucide-react";
import { useStore } from "@/store";
import { PointStatus, STATUS_LABELS, Point } from "@/types";
import { StatusBadge, StatusDot } from "@/components/StatusBadge";

const STATUS_COLUMNS: PointStatus[] = ["processed", "pending", "field_review"];

const COLUMN_COLORS: Record<PointStatus, string> = {
  processed: "#10b981",
  pending: "#f59e0b",
  field_review: "#FF6B35",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function PointCard({ point, feedbackCount }: { point: Point; feedbackCount: number }) {
  const isEmpty = !point.standardName;

  return (
    <Link
      to={`/point/${point.id}`}
      className="block rounded-lg border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MapPin size={14} className="shrink-0" style={{ color: "#1A535C" }} />
          <span className="truncate text-sm font-medium text-gray-900">
            {isEmpty ? "空记录" : point.standardName}
          </span>
        </div>
        {feedbackCount > 0 && (
          <span
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: "#FF6B35" }}
          >
            <MessageSquare size={10} />
            {feedbackCount}
          </span>
        )}
      </div>
      <div className="mb-2 flex items-center gap-2">
        {isEmpty ? (
          <span className="inline-block rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-500">
            空记录
          </span>
        ) : (
          <span className="text-xs text-gray-500">{point.schoolName}</span>
        )}
      </div>
      <div className="flex items-center justify-between">
        <StatusDot status={point.status} />
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <Clock size={10} />
          {formatTime(point.updatedAt)}
        </div>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const points = useStore((s) => s.points);
  const feedbacks = useStore((s) => s.feedbacks);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<PointStatus | "all">("all");

  const feedbackCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const fb of feedbacks) {
      map[fb.pointId] = (map[fb.pointId] || 0) + 1;
    }
    return map;
  }, [feedbacks]);

  const filteredPoints = useMemo(() => {
    const q = search.trim().toLowerCase();
    return points.filter((p) => {
      if (filterStatus !== "all" && p.status !== filterStatus) return false;
      if (!q) return true;
      return (
        p.standardName.toLowerCase().includes(q) ||
        p.schoolName.toLowerCase().includes(q)
      );
    });
  }, [points, search, filterStatus]);

  const grouped = useMemo(() => {
    const result: Record<PointStatus, Point[]> = {
      processed: [],
      pending: [],
      field_review: [],
    };
    for (const p of filteredPoints) {
      result[p.status].push(p);
    }
    return result;
  }, [filteredPoints]);

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: "#f8fafb" }}>
      <header className="shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto max-w-7xl">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-xl font-bold" style={{ color: "#1A535C" }}>
              慢行安全点位看板
            </h1>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>共 {filteredPoints.length} 个点位</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="搜索点位名称或学校名称..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[#1A535C] focus:bg-white"
              />
            </div>
            <div className="relative">
              <Filter size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as PointStatus | "all")}
                className="appearance-none rounded-lg border border-gray-200 bg-gray-50 py-2 pl-8 pr-8 text-sm outline-none transition-colors focus:border-[#1A535C] focus:bg-white"
              >
                <option value="all">全部状态</option>
                {STATUS_COLUMNS.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {STATUS_COLUMNS.map((status) => (
          <div key={status} className="flex flex-1 flex-col border-r border-gray-200 last:border-r-0">
            <div
              className="flex shrink-0 items-center gap-2 border-b border-gray-200 px-4 py-3"
              style={{ borderBottomColor: COLUMN_COLORS[status], borderBottomWidth: 2 }}
            >
              <StatusDot status={status} />
              <span className="text-sm font-semibold text-gray-800">{STATUS_LABELS[status]}</span>
              <span
                className="ml-auto rounded-full px-2 py-0.5 text-xs font-medium text-white"
                style={{ backgroundColor: COLUMN_COLORS[status] }}
              >
                {grouped[status].length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="flex flex-col gap-3">
                {grouped[status].map((point) => (
                  <PointCard
                    key={point.id}
                    point={point}
                    feedbackCount={feedbackCounts[point.id] || 0}
                  />
                ))}
                {grouped[status].length === 0 && (
                  <div className="py-8 text-center text-sm text-gray-400">
                    暂无点位
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
