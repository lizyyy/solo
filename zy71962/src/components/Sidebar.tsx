import {
  Upload,
  Edit3,
  Undo2,
  Download,
  AlertTriangle,
} from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import type { AuditLog } from "../../shared/types";

const iconMap: Record<AuditLog["operationType"], typeof Upload> = {
  import: Upload,
  correction: Edit3,
  rollback: Undo2,
  filter_export: Download,
  leak_detected: AlertTriangle,
};

const colorMap: Record<AuditLog["operationType"], string> = {
  import: "text-blue-400",
  correction: "text-amber-400",
  rollback: "text-purple-400",
  filter_export: "text-zinc-400",
  leak_detected: "text-red-400",
};

const labelMap: Record<AuditLog["operationType"], string> = {
  import: "导入",
  correction: "修正",
  rollback: "撤回",
  filter_export: "导出",
  leak_detected: "泄漏告警",
};

export default function Sidebar() {
  const { sidebarOpen, auditLogs } = useStore();
  const recentLogs = auditLogs.slice(0, 20);

  return (
    <aside
      className={cn(
        "h-full bg-zinc-950 border-r border-zinc-800 transition-all duration-300 overflow-hidden flex flex-col shrink-0",
        sidebarOpen ? "w-[280px]" : "w-0"
      )}
    >
      <div className="w-[280px] min-w-[280px] flex flex-col h-full">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h2 className="font-mono-display text-sm font-semibold text-zinc-300">
            操作时间线
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {recentLogs.length === 0 && (
            <p className="text-zinc-600 text-sm text-center py-8">
              暂无操作记录
            </p>
          )}

          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-px bg-zinc-800" />

            <div className="space-y-4">
              {recentLogs.map((log) => {
                const Icon = iconMap[log.operationType];
                const color = colorMap[log.operationType];
                const label = labelMap[log.operationType];

                return (
                  <div key={log.id} className="relative pl-8">
                    <div
                      className={cn(
                        "absolute left-1 top-1 w-5 h-5 rounded-full bg-zinc-900 flex items-center justify-center",
                        color
                      )}
                    >
                      <Icon className="w-3 h-3" />
                    </div>

                    <div className="text-xs text-zinc-500 font-mono-display">
                      {new Date(log.createdAt).toLocaleString("zh-CN")}
                    </div>
                    <div className="text-sm text-zinc-300">
                      <span className={cn("font-medium", color)}>
                        {label}
                      </span>
                      {log.operator && (
                        <span className="text-zinc-500 ml-1">
                          · {log.operator}
                        </span>
                      )}
                    </div>
                    {log.targetFeatureName && (
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {log.targetFeatureName}
                      </div>
                    )}
                    {log.reason && (
                      <div className="text-xs text-zinc-500 mt-0.5 truncate">
                        {log.reason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
