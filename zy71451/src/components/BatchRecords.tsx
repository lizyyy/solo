import { useState } from "react"
import { Database, Clock, AlertTriangle, CheckCircle, XCircle, ChevronDown, Filter, X, Send } from "lucide-react"
import { useClusterStore } from "@/store/clusterStore"
import type { BatchStatus } from "@/types"
import { cn } from "@/lib/utils"

const STATUS_CONFIG: Record<BatchStatus, { label: string; color: string; bg: string; icon: any }> = {
  processed: {
    label: "已处理",
    color: "text-[#00b894]",
    bg: "bg-[#00b894]/10",
    icon: CheckCircle,
  },
  pending: {
    label: "待确认",
    color: "text-[#f5a623]",
    bg: "bg-[#f5a623]/10",
    icon: AlertTriangle,
  },
  rejected: {
    label: "需退回补材料",
    color: "text-[#ff6b6b]",
    bg: "bg-[#ff6b6b]/10",
    icon: XCircle,
  },
}

function RejectModal({
  batchId,
  onClose,
  onConfirm,
}: {
  batchId: string
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState("")

  const presetReasons = [
    "特征列存在缺失值，请补齐或标注缺失策略",
    "聚类标签缺失，请补充标签列",
    "样本ID与已有数据冲突，请检查",
    "数据格式错误，请确认CSV/JSON格式",
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a2332] rounded-xl border border-[#2a3444] shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2a3444] flex items-center justify-between">
          <h3 className="font-['Space_Grotesk'] text-sm font-semibold text-[#e8edf5]">退回补材料</h3>
          <button onClick={onClose} className="text-[#5a6a7a] hover:text-[#e8edf5] transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs font-['DM_Sans'] text-[#8a9aaa] mb-3">请填写退回原因（必填）</p>

          <div className="space-y-1.5 mb-3">
            {presetReasons.map((r, i) => (
              <button
                key={i}
                onClick={() => setReason(r)}
                className={cn(
                  "w-full text-left text-[11px] font-['DM_Sans'] px-3 py-2 rounded-lg transition-colors",
                  reason === r
                    ? "bg-[#f5a623]/15 text-[#f5a623] border border-[#f5a623]/30"
                    : "bg-[#0f1822] text-[#8a9aaa] border border-transparent hover:border-[#2a3444]"
                )}
              >
                {r}
              </button>
            ))}
          </div>

          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="或自定义原因，如：特征列'income'含32%缺失值，请补齐或标注缺失策略"
            rows={3}
            className="w-full bg-[#0f1822] border border-[#2a3444] rounded-lg px-3 py-2 text-xs font-['DM_Sans'] text-[#e8edf5] placeholder-[#5a6a7a] resize-none focus:outline-none focus:border-[#f5a623]/50 transition-colors"
          />
        </div>

        <div className="px-5 py-4 border-t border-[#2a3444] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-['DM_Sans'] text-[#8a9aaa] hover:text-[#e8edf5] transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => reason.trim() && onConfirm(reason.trim())}
            disabled={!reason.trim()}
            className={cn(
              "px-4 py-2 text-xs font-['DM_Sans'] rounded-lg font-semibold transition-colors flex items-center gap-1.5",
              reason.trim()
                ? "bg-[#ff6b6b] text-white hover:bg-[#ff5252]"
                : "bg-[#2a3444] text-[#5a6a7a] cursor-not-allowed"
            )}
          >
            <Send size={12} />
            提交退回
          </button>
        </div>
      </div>
    </div>
  )
}

export default function BatchRecords() {
  const [filter, setFilter] = useState<BatchStatus | "all">("all")
  const [expanded, setExpanded] = useState(true)
  const [rejectingBatch, setRejectingBatch] = useState<string | null>(null)
  const dataBatches = useClusterStore((s) => s.dataBatches)
  const setBatchStatus = useClusterStore((s) => s.setBatchStatus)
  const conflicts = useClusterStore((s) => s.conflicts)

  const filteredBatches =
    filter === "all" ? dataBatches : dataBatches.filter((b) => b.status === filter)

  const sortedBatches = [...filteredBatches].sort(
    (a, b) => new Date(b.loadedAt).getTime() - new Date(a.loadedAt).getTime()
  )

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const hasUnresolvedConflict = (batchId: string) => {
    return conflicts.some((c) => c.batchId === batchId && !c.resolved)
  }

  const handleStatusChange = (batchId: string, newStatus: BatchStatus) => {
    if (newStatus === "rejected") {
      setRejectingBatch(batchId)
    } else {
      setBatchStatus(batchId, newStatus)
    }
  }

  return (
    <div className="bg-[#1a2332] rounded-xl border border-[#2a3444] overflow-hidden">
      <div
        className="px-4 py-3 flex items-center gap-2 cursor-pointer hover:bg-[#0f1822]/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <Database size={14} className="text-[#00f5d4]" />
        <h3 className="font-['Space_Grotesk'] text-sm font-semibold text-[#e8edf5] flex-1">数据批次记录</h3>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {(["processed", "pending", "rejected"] as BatchStatus[]).map((status) => {
              const count = dataBatches.filter((b) => b.status === status).length
              if (count === 0) return null
              const cfg = STATUS_CONFIG[status]
              return (
                <span
                  key={status}
                  className={`text-[9px] font-['DM_Sans'] font-semibold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}
                >
                  {count}
                </span>
              )
            })}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              const options = ["all", "processed", "pending", "rejected"] as const
              const idx = options.indexOf(filter)
              setFilter(options[(idx + 1) % options.length])
            }}
            className="text-[10px] font-['DM_Sans] text-[#5a6a7a] hover:text-[#00f5d4] transition-colors flex items-center gap-1"
          >
            <Filter size={10} />
            {filter === "all" ? "全部" : STATUS_CONFIG[filter].label}
          </button>
          <ChevronDown
            size={14}
            className={cn(
              "text-[#5a6a7a] transition-transform",
              expanded && "rotate-180"
            )}
          />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-[#2a3444]">
          {sortedBatches.length === 0 ? (
            <div className="py-6 text-center text-[10px] font-['DM_Sans'] text-[#5a6a7a]">
              暂无数据批次记录
            </div>
          ) : (
            <div className="max-h-[200px] overflow-y-auto">
              {sortedBatches.map((batch) => {
                const cfg = STATUS_CONFIG[batch.status]
                const StatusIcon = cfg.icon
                const hasConflict = hasUnresolvedConflict(batch.id)

                return (
                  <div
                    key={batch.id}
                    className="px-4 py-2.5 border-b border-[#2a3444] last:border-b-0 hover:bg-[#0f1822]/30 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                          cfg.bg
                        )}
                      >
                        <StatusIcon size={12} className={cfg.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-['DM_Sans'] text-[#e8edf5] truncate">
                            {batch.fileName}
                          </span>
                          {hasConflict && (
                            <span className="shrink-0 text-[9px] font-['DM_Sans'] text-[#f5a623] bg-[#f5a623]/10 px-1.5 py-0.5 rounded">
                              冲突待处理
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Clock size={9} className="text-[#5a6a7a]" />
                          <span className="text-[10px] font-['DM_Sans'] text-[#5a6a7a]">
                            {formatDate(batch.loadedAt)}
                          </span>
                        </div>
                        {batch.rejectReason && (
                          <div className="mt-1.5 text-[10px] font-['DM_Sans'] text-[#ff6b6b] bg-[#ff6b6b]/10 px-2 py-1 rounded">
                            退回原因：{batch.rejectReason}
                          </div>
                        )}
                      </div>
                      <select
                        value={batch.status}
                        onChange={(e) => handleStatusChange(batch.id, e.target.value as BatchStatus)}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[10px] font-['DM_Sans'] bg-[#0f1822] border border-[#2a3444] rounded px-2 py-1 text-[#8a9aaa] focus:outline-none focus:border-[#00f5d4]/50 cursor-pointer"
                      >
                        <option value="processed">已处理</option>
                        <option value="pending">待确认</option>
                        <option value="rejected">需退回补材料</option>
                      </select>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {rejectingBatch && (
        <RejectModal
          batchId={rejectingBatch}
          onClose={() => setRejectingBatch(null)}
          onConfirm={(reason) => {
            setBatchStatus(rejectingBatch, "rejected", reason)
            setRejectingBatch(null)
          }}
        />
      )}
    </div>
  )
}
