import { useState } from "react"
import {
  History,
  Tag,
  SlidersHorizontal,
  Gauge,
  Database,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  Undo2,
} from "lucide-react"
import { useClusterStore } from "@/store/clusterStore"
import type { OperationType } from "@/types"
import { cn } from "@/lib/utils"

const OPERATION_CONFIG: Record<OperationType, { label: string; icon: any; color: string }> = {
  label_change: {
    label: "标签修改",
    icon: Tag,
    color: "text-[#00f5d4]",
  },
  feature_toggle: {
    label: "特征切换",
    icon: SlidersHorizontal,
    color: "text-[#6c5ce7]",
  },
  threshold_adjust: {
    label: "阈值调整",
    icon: Gauge,
    color: "text-[#f5a623]",
  },
  status_change: {
    label: "状态变更",
    icon: Database,
    color: "text-[#00b894]",
  },
  data_merge: {
    label: "数据合并",
    icon: Database,
    color: "text-[#fd79a8]",
  },
  rollback: {
    label: "回滚操作",
    icon: RotateCcw,
    color: "text-[#ff6b6b]",
  },
}

export default function HistoryTimeline() {
  const [expanded, setExpanded] = useState(false)
  const history = useClusterStore((s) => s.history)
  const showHistoryPanel = useClusterStore((s) => s.showHistoryPanel)
  const toggleHistoryPanel = useClusterStore((s) => s.toggleHistoryPanel)
  const rollbackTo = useClusterStore((s) => s.rollbackTo)

  const isOpen = expanded || showHistoryPanel

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const today = new Date()
    const isToday = d.toDateString() === today.toDateString()
    return isToday
      ? "今天 " + formatTime(iso)
      : d.toLocaleDateString("zh-CN", { month: "2-digit", day: "2-digit" }) + " " + formatTime(iso)
  }

  const handleRollback = (e: React.MouseEvent, entryId: string) => {
    e.stopPropagation()
    if (confirm("确定要回滚到此操作吗？之后的所有操作将被撤销。")) {
      rollbackTo(entryId)
    }
  }

  return (
    <div
      className={cn(
        "absolute bottom-0 left-0 right-0 bg-[#1a2332]/95 backdrop-blur-sm border-t border-[#2a3444] transition-all duration-300 rounded-t-xl overflow-hidden",
        isOpen ? "h-[220px]" : "h-[44px]"
      )}
    >
      <div
        className="px-4 py-3 flex items-center gap-2 cursor-pointer hover:bg-[#0f1822]/30 transition-colors"
        onClick={() => {
          setExpanded(!expanded)
          if (showHistoryPanel && !expanded) toggleHistoryPanel()
        }}
      >
        <History size={14} className="text-[#00f5d4]" />
        <h3 className="font-['Space_Grotesk'] text-sm font-semibold text-[#e8edf5]">操作历史</h3>
        {history.length > 0 && (
          <span className="text-[10px] font-['DM_Sans'] text-[#5a6a7a] bg-[#0f1822] px-1.5 py-0.5 rounded">
            {history.length} 条记录
          </span>
        )}
        <div className="flex-1" />
        <span className="text-[10px] font-['DM_Sans'] text-[#5a6a7a]">
          {isOpen ? "点击收起" : "点击展开"}
        </span>
        {isOpen ? (
          <ChevronDown size={14} className="text-[#5a6a7a]" />
        ) : (
          <ChevronUp size={14} className="text-[#5a6a7a]" />
        )}
      </div>

      {isOpen && (
        <div className="border-t border-[#2a3444] h-[176px] overflow-y-auto px-4 py-3">
          {history.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-[10px] font-['DM_Sans'] text-[#5a6a7a]">暂无操作记录</p>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-[7px] top-0 bottom-0 w-px bg-[#2a3444]" />

              <div className="space-y-3">
                {history.map((entry, idx) => {
                  const cfg = OPERATION_CONFIG[entry.operationType]
                  const Icon = cfg.icon
                  const isLatest = idx === 0

                  return (
                    <div key={entry.id} className="relative pl-6 group">
                      <div
                        className={cn(
                          "absolute left-0 top-1 w-3.5 h-3.5 rounded-full border-2 border-[#1a2332] flex items-center justify-center",
                          isLatest ? "bg-[#00f5d4]" : "bg-[#2a3444]"
                        )}
                      >
                        {isLatest && <div className="w-1.5 h-1.5 rounded-full bg-[#1a2332]" />}
                      </div>

                      <div
                        className={cn(
                          "rounded-lg p-2.5 transition-all",
                          isLatest
                            ? "bg-[#0f1822] border border-[#00f5d4]/20"
                            : "bg-[#0f1822]/50 hover:bg-[#0f1822] border border-transparent hover:border-[#2a3444]"
                        )}
                      >
                        <div className="flex items-start gap-2">
                          <Icon size={12} className={cn(cfg.color, "mt-0.5 shrink-0")} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-['DM_Sans'] text-[#e8edf5] font-medium">
                                {cfg.label}
                              </span>
                              <span className="text-[9px] font-['DM_Sans'] text-[#5a6a7a]">
                                {formatDate(entry.timestamp)}
                              </span>
                              {isLatest && (
                                <span className="text-[9px] font-['DM_Sans'] text-[#00f5d4] bg-[#00f5d4]/10 px-1.5 py-0.5 rounded">
                                  最新
                                </span>
                              )}
                            </div>

                            <div className="text-[10px] font-['DM_Sans'] text-[#8a9aaa] mt-1">
                              目标: <span className="text-[#5a6a7a] font-mono">{entry.targetId}</span>
                            </div>

                            {entry.beforeValue && entry.afterValue && (
                              <div className="text-[10px] font-['DM_Sans'] mt-1 flex items-center gap-2">
                                <span className="text-[#ff6b6b] line-through">{entry.beforeValue}</span>
                                <span className="text-[#5a6a7a]">→</span>
                                <span className="text-[#00f5d4]">{entry.afterValue}</span>
                              </div>
                            )}

                            <div className="text-[9px] font-['DM_Sans'] text-[#5a6a7a] mt-1">
                              操作者: {entry.operator}
                            </div>
                          </div>

                          {entry.operationType !== "rollback" && (
                            <button
                              onClick={(e) => handleRollback(e, entry.id)}
                              className="opacity-0 group-hover:opacity-100 text-[#5a6a7a] hover:text-[#ff6b6b] transition-all p-1 hover:bg-[#ff6b6b]/10 rounded"
                              title="回滚到此操作"
                            >
                              <Undo2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
