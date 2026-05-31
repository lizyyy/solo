import { useEffect, useState } from "react";
import {
  Upload,
  Edit3,
  Undo2,
  Download,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import type { AuditLog } from "../../shared/types";

const opConfig: Record<
  AuditLog["operationType"],
  { label: string; icon: typeof Upload; color: string; bg: string }
> = {
  import: { label: "导入", icon: Upload, color: "text-blue-400", bg: "bg-blue-500/10" },
  correction: { label: "修正", icon: Edit3, color: "text-amber-400", bg: "bg-amber-500/10" },
  rollback: { label: "撤回", icon: Undo2, color: "text-purple-400", bg: "bg-purple-500/10" },
  filter_export: { label: "导出", icon: Download, color: "text-zinc-400", bg: "bg-zinc-500/10" },
  leak_detected: { label: "泄漏告警", icon: AlertTriangle, color: "text-red-400", bg: "bg-red-500/10" },
};

export default function AuditLogPage() {
  const { auditLogs, fetchAuditLogs, rollbackFeature } = useStore();
  const [opType, setOpType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  function handleFilter() {
    fetchAuditLogs({
      operationType: opType || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  }

  async function handleRollback(log: AuditLog) {
    if (!log.targetFeatureId) return;
    const operator = prompt("请输入操作人姓名");
    if (!operator) return;
    await rollbackFeature(log.targetFeatureId, operator.trim());
    fetchAuditLogs({
      operationType: opType || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="p-6">
      <h1 className="font-mono-display text-2xl font-bold text-zinc-100 mb-6">
        操作留痕
      </h1>

      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <select
          value={opType}
          onChange={(e) => setOpType(e.target.value)}
          className="input-dark text-sm w-36"
        >
          <option value="">全部操作类型</option>
          <option value="import">导入</option>
          <option value="correction">修正</option>
          <option value="rollback">撤回</option>
          <option value="filter_export">导出</option>
          <option value="leak_detected">泄漏告警</option>
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="input-dark text-sm w-36"
          placeholder="开始日期"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="input-dark text-sm w-36"
          placeholder="结束日期"
        />
        <button onClick={handleFilter} className="btn-primary text-sm">
          筛选
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-left">
              {["操作类型", "操作人", "目标特征", "变更前", "变更后", "原因", "时间", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 font-mono-display font-semibold text-zinc-400 text-xs uppercase tracking-wider"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {auditLogs.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-zinc-500">
                  暂无操作记录
                </td>
              </tr>
            )}
            {auditLogs.map((log, idx) => {
              const cfg = opConfig[log.operationType];
              const Icon = cfg.icon;
              const isExpanded = expanded.has(log.id);

              return (
                <tr
                  key={log.id}
                  className={cn(
                    "border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors",
                    idx % 2 === 1 && "bg-zinc-900/50"
                  )}
                >
                  <td className="px-4 py-3">
                    <span className={cn("badge gap-1", cfg.color, cfg.bg)}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{log.operator}</td>
                  <td className="px-4 py-3 font-mono-display text-zinc-200 text-xs">
                    {log.targetFeatureName || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono-display text-zinc-500 text-xs max-w-[160px] truncate">
                    {log.beforeValue || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono-display text-zinc-300 text-xs max-w-[160px] truncate">
                    {log.afterValue || "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-400 max-w-[160px] truncate">
                    {log.reason || "—"}
                  </td>
                  <td className="px-4 py-3 text-zinc-500 font-mono-display text-xs whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString("zh-CN")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {log.filterSnapshot && (
                        <button
                          onClick={() => toggleExpand(log.id)}
                          className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300 transition-colors"
                          title="筛选快照"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                      {log.operationType === "correction" && log.targetFeatureId && (
                        <button
                          onClick={() => handleRollback(log)}
                          className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-purple-400 transition-colors"
                          title="撤回此修正"
                        >
                          <Undo2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {Array.from(expanded).map((id) => {
        const log = auditLogs.find((l) => l.id === id);
        if (!log?.filterSnapshot) return null;
        return (
          <div
            key={`snapshot-${id}`}
            className="mx-4 mt-1 p-3 bg-zinc-800 rounded border border-zinc-700 text-xs font-mono-display text-zinc-400"
          >
            <span className="text-zinc-500 font-medium">筛选快照: </span>
            {log.filterSnapshot}
          </div>
        );
      })}
    </div>
  );
}
