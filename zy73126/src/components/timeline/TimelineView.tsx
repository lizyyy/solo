import { useMemo } from "react";
import { Clock, Filter, Tag } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import { ANOMALY_LABEL, STATUS_LABEL } from "../../data/types";
import type { TimelineEventType, FilterSnapshot } from "../../data/types";

const EVENT_TYPE_LABEL: Record<TimelineEventType, string> = {
  import: "📥 导入",
  detect: "🔍 检测",
  filter: "🔽 筛选",
  note: "📝 备注",
  status_change: "🔄 状态变更",
  export: "📤 导出",
  sample_load: "📦 加载样例",
};

const EVENT_DOT_COLOR: Record<TimelineEventType, string> = {
  import: "bg-deep-300",
  detect: "bg-coral-400",
  filter: "bg-reef-500",
  note: "bg-coral-300",
  status_change: "bg-alert-500",
  export: "bg-deep-200",
  sample_load: "bg-reef-400",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function SnapshotTags({ snapshot }: { snapshot: FilterSnapshot }) {
  const items: string[] = [];
  if (snapshot.station) items.push(`站点: ${snapshot.station}`);
  if (snapshot.anomalyType) items.push(`异常: ${ANOMALY_LABEL[snapshot.anomalyType]}`);
  if (snapshot.status) items.push(`状态: ${STATUS_LABEL[snapshot.status]}`);
  if (snapshot.dateFrom) items.push(`从: ${snapshot.dateFrom}`);
  if (snapshot.dateTo) items.push(`至: ${snapshot.dateTo}`);
  if (snapshot.keyword) items.push(`关键词: ${snapshot.keyword}`);
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      <Filter size={12} className="text-deep-200 mt-0.5" />
      {items.map((t) => (
        <span key={t} className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded bg-deep-50 text-deep-300">
          <Tag size={10} />
          {t}
        </span>
      ))}
    </div>
  );
}

export default function TimelineView() {
  const timeline = useAppStore((s) => s.timeline);

  const sorted = useMemo(
    () => [...timeline].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [timeline]
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <Clock size={20} className="text-coral-400" />
        <h2 className="text-lg font-semibold text-deep-400">🧭 操作历史时间线</h2>
        <span className="text-sm text-deep-200">共 {sorted.length} 条</span>
      </div>

      {sorted.length === 0 ? (
        <div className="flex items-center justify-center h-40 text-deep-200 text-sm">暂无操作记录</div>
      ) : (
        <div className="relative pl-6 border-l-2 border-deep-50">
          {sorted.map((ev) => (
            <div key={ev.id} className="relative mb-6 last:mb-0 animate-fade-up">
              <span
                className={`absolute -left-[calc(0.75rem+5px)] top-2 w-2.5 h-2.5 rounded-full ${EVENT_DOT_COLOR[ev.eventType]}`}
              />
              <div className="bg-white rounded-xl border border-deep-50 p-3.5 shadow-sm ml-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-6 h-6 rounded-full bg-deep-50 flex items-center justify-center text-xs font-medium text-deep-300">
                    {ev.operator.charAt(0)}
                  </span>
                  <span className="text-sm font-medium text-deep-400">{ev.operator}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-deep-50 text-deep-300">
                    {EVENT_TYPE_LABEL[ev.eventType]}
                  </span>
                  <span className="ml-auto text-xs text-deep-200">{formatTime(ev.createdAt)}</span>
                </div>
                <p className="text-sm text-deep-300">{ev.description}</p>
                {ev.filterSnapshot && <SnapshotTags snapshot={ev.filterSnapshot} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
