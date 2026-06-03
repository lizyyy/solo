import { useState } from "react"
import { FileText, Check, X, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { CounterExample, CounterExampleStatus } from "@/types"
import useAppStore from "@/store/useAppStore"

interface CounterExampleTableProps {
  onSelectId: (id: string) => void
  onConflictClick?: (id: string) => void
}

const statusConfig: Record<CounterExampleStatus, { label: string; className: string }> = {
  normal: { label: "正常", className: "bg-[#0a2a1a] text-[#0ff0b3]" },
  boundary: { label: "边界", className: "bg-[#0a1a2a] text-[#4488ff]" },
  conflict: { label: "冲突", className: "bg-[#2a0a0a] text-[#ff4444]" },
  pending_review: { label: "待复核", className: "bg-[#2a1a0a] text-[#ff9f1c]" },
}

const sourceLabels: Record<string, string> = {
  normal: "常态",
  mismatch: "失配",
  supplementary: "补充",
}

export default function CounterExampleTable({ onSelectId, onConflictClick }: CounterExampleTableProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const counterExamples = useAppStore((s) => s.counterExamples)
  const conflictEvidences = useAppStore((s) => s.conflictEvidences)
  const resolveConflict = useAppStore((s) => s.resolveConflict)
  const addToast = useAppStore((s) => s.addToast)

  const handleRowClick = (id: string) => {
    setSelectedId(id)
    onSelectId(id)
  }

  const handleConfirm = (e: React.MouseEvent, ce: CounterExample) => {
    e.stopPropagation()
    resolveConflict(ce.id, "confirmed")
    addToast("success", `反例 ${ce.id} 已确认`)
  }

  const handleReject = (e: React.MouseEvent, ce: CounterExample) => {
    e.stopPropagation()
    resolveConflict(ce.id, "rejected")
    addToast("info", `反例 ${ce.id} 已驳回`)
  }

  return (
    <div className="w-full overflow-x-auto rounded-lg border border-[#2a2a5a] bg-[#16163a]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#2a2a5a] text-[#8888aa]">
            <th className="px-4 py-3 text-left font-medium">ID</th>
            <th className="px-4 py-3 text-left font-medium">来源</th>
            <th className="px-4 py-3 text-right font-medium">原始值</th>
            <th className="px-4 py-3 text-right font-medium">阈值</th>
            <th className="px-4 py-3 text-right font-medium">偏差</th>
            <th className="px-4 py-3 text-center font-medium">状态</th>
            <th className="px-4 py-3 text-center font-medium">操作</th>
          </tr>
        </thead>
        <tbody>
          {counterExamples.map((ce) => {
            const config = statusConfig[ce.status]
            const hasConflict = conflictEvidences.some((ev) => ev.counterExampleId === ce.id)
            const noResolution = ce.conflictResolution === null
            const isSelected = selectedId === ce.id

            return (
              <tr
                key={ce.id}
                onClick={() => handleRowClick(ce.id)}
                className={cn(
                  "cursor-pointer border-b border-[#2a2a5a]/50 transition-colors hover:bg-[#1e1e4a]",
                  isSelected && "bg-[#1e1e4a]"
                )}
              >
                <td className="px-4 py-3 font-mono text-[#0ff0b3]">{ce.id}</td>
                <td className="px-4 py-3 text-[#ccccdd]">{sourceLabels[ce.source] ?? ce.source}</td>
                <td className="px-4 py-3 text-right text-[#ccccdd]">{ce.originalValue}</td>
                <td className="px-4 py-3 text-right text-[#ccccdd]">{ce.threshold}</td>
                <td className="px-4 py-3 text-right text-[#ccccdd]">{ce.deviation}</td>
                <td className="px-4 py-3 text-center">
                  <span className={cn("inline-block rounded-full px-2.5 py-0.5 text-xs font-medium", config.className)}>
                    {config.label}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    {ce.questionnaireRowId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelectId(ce.id) }}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs text-[#4488ff] hover:bg-[#0a1a2a]"
                      >
                        <FileText size={12} />
                        查看问卷
                      </button>
                    )}
                    {hasConflict && noResolution && (
                      <>
                        {onConflictClick && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onConflictClick(ce.id) }}
                            className="flex items-center gap-1 rounded bg-[#2a0a0a] px-2 py-1 text-xs text-[#ff4444] hover:bg-[#ff4444]/20"
                          >
                            冲突详情
                          </button>
                        )}
                        <button
                          onClick={(e) => handleConfirm(e, ce)}
                          className="flex items-center gap-1 rounded bg-[#0a2a1a] px-2 py-1 text-xs text-[#0ff0b3] hover:bg-[#0ff0b3]/20"
                        >
                          <Check size={12} />
                          确认
                        </button>
                        <button
                          onClick={(e) => handleReject(e, ce)}
                          className="flex items-center gap-1 rounded bg-[#2a1a0a] px-2 py-1 text-xs text-[#ff9f1c] hover:bg-[#ff9f1c]/20"
                        >
                          <X size={12} />
                          驳回
                        </button>
                      </>
                    )}
                    {ce.status === "pending_review" && (
                      <span className="flex items-center gap-1 text-xs text-[#ff9f1c]">
                        <AlertTriangle size={12} />
                        待任课老师复核
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            )
          })}
          {counterExamples.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-[#666688]">
                暂无反例数据
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
