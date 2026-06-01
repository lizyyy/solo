import { ChevronUp, ChevronDown } from "lucide-react"
import type { AuditAction } from "@/data/types"
import { useAppStore } from "@/store/useAppStore"

const ACTION_COLORS: Record<AuditAction, string> = {
  filter: "#6C63FF",
  select: "#22C55E",
  annotate: "#F0A500",
  correct: "#E94560",
  export: "#888888",
  supplement: "#3B82F6",
}

const ACTION_LABELS: Record<AuditAction, string> = {
  filter: "筛选",
  select: "选中",
  annotate: "标注",
  correct: "修正",
  export: "导出",
  supplement: "补录",
}

export default function AuditLogPanel() {
  const { auditLogs, auditPanelOpen, toggleAuditPanel } = useAppStore()
  const sortedLogs = [...auditLogs].reverse()

  return (
    <div
      className="shrink-0 border-t border-white/10 bg-[#0D1117] flex flex-col transition-[height] duration-200"
      style={{ height: auditPanelOpen ? 200 : 32 }}
    >
      <button
        onClick={toggleAuditPanel}
        className="h-8 flex items-center justify-center gap-1.5 text-white/50 hover:text-white/80 text-xs transition-colors shrink-0"
      >
        {auditPanelOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        <span>审计日志 ({auditLogs.length})</span>
      </button>

      {auditPanelOpen && (
        <div className="flex-1 overflow-y-auto px-4 pb-2 font-mono text-xs">
          {sortedLogs.length === 0 ? (
            <div className="text-white/20 py-4 text-center">暂无日志</div>
          ) : (
            sortedLogs.map(log => (
              <div key={log.id} className="flex items-start gap-2 py-1.5 border-b border-white/5">
                <span className="text-white/30 shrink-0 w-[72px]">
                  {new Date(log.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span
                  className="shrink-0 px-1.5 py-0.5 rounded text-[10px] text-white font-medium"
                  style={{ backgroundColor: ACTION_COLORS[log.action] }}
                >
                  {ACTION_LABELS[log.action]}
                </span>
                {log.targetId && (
                  <span className="shrink-0 text-white/40">{log.targetId}</span>
                )}
                <span className="text-white/50 truncate">{log.details}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
