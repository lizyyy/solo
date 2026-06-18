import { useMemo } from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import { ANOMALY_LABEL, STATUS_LABEL } from "@/data/types";
import type { AnomalyType, RecordStatus } from "@/data/types";

const STATUS_STYLE: Record<RecordStatus, string> = {
  pending: "bg-deep-100 text-deep-500",
  confirmed: "bg-reef-400/20 text-reef-600",
  pending_info: "bg-coral-50 text-coral-600",
  returned: "bg-alert-400/20 text-alert-600",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function DataTable() {
  const getFilteredRecords = useAppStore((s) => s.getFilteredRecords);
  const records = useAppStore((s) => s.records);
  const activeFilters = useAppStore((s) => s.activeFilters);
  const selectRecord = useAppStore((s) => s.selectRecord);
  const selectedRecordId = useAppStore((s) => s.selectedRecordId);

  const filtered = useMemo(() => getFilteredRecords(), [records, activeFilters, getFilteredRecords]);

  if (filtered.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-deep-300 text-sm">暂无数据</div>
    );
  }

  return (
    <div className="app-card overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between border-b border-deep-50">
        <span className="section-title">数据列表</span>
        <span className="text-xs text-deep-300">共 {filtered.length} 条</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-deep-50 bg-deep-50/20">
              <th className="px-4 py-2.5 text-left label">站点</th>
              <th className="px-4 py-2.5 text-left label">采样时间</th>
              <th className="px-4 py-2.5 text-left label">潮位</th>
              <th className="px-4 py-2.5 text-left label">水温（°C）</th>
              <th className="px-4 py-2.5 text-left label">白化率（%）</th>
              <th className="px-4 py-2.5 text-left label">异常标记</th>
              <th className="px-4 py-2.5 text-left label">状态</th>
              <th className="px-4 py-2.5 text-left label">操作</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, idx) => {
              const hasAnomaly = r.anomalies.length > 0;
              const isSelected = r.id === selectedRecordId;
              return (
                <tr
                  key={r.id}
                  onClick={() => selectRecord(r.id)}
                  className={cn(
                    "border-b border-deep-50/50 cursor-pointer transition-colors hover:bg-deep-50/20",
                    idx % 2 === 1 && "bg-deep-50/30",
                    hasAnomaly && "border-l-[3px] border-l-coral-400 animate-coral-pulse",
                    isSelected && "bg-deep-50/40",
                  )}
                >
                  <td className="px-4 py-2.5 font-medium text-deep-500">{r.station || "-"}</td>
                  <td className="px-4 py-2.5 mono text-deep-400">{formatTime(r.sampledAt)}</td>
                  <td className="px-4 py-2.5 text-deep-400">{r.tideLevel || "-"}</td>
                  <td className="px-4 py-2.5 mono text-deep-400">{r.waterTemp ?? "-"}</td>
                  <td className="px-4 py-2.5 mono text-deep-400">{r.bleachingRate ?? "-"}</td>
                  <td className="px-4 py-2.5">
                    {r.anomalies.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {r.anomalies.map((a) => (
                          <span key={a.id} className="chip bg-coral-100 text-coral-500">
                            {ANOMALY_LABEL[a.type as AnomalyType]}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-deep-200">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn("chip", STATUS_STYLE[r.status])}>
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <button
                      onClick={(e) => { e.stopPropagation(); selectRecord(r.id); }}
                      className="btn-ghost"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      详情
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
