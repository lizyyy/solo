import { ArrowRight, X, Check, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ConflictEvidence, QuestionnaireRow } from "@/types"
import useAppStore from "@/store/useAppStore"

interface ConflictModalProps {
  isOpen: boolean
  ceId: string | null
  onClose: () => void
}

export default function ConflictModal({ isOpen, ceId, onClose }: ConflictModalProps) {
  const counterExamples = useAppStore((s) => s.counterExamples)
  const conflictEvidences = useAppStore((s) => s.conflictEvidences)
  const questionnaireRows = useAppStore((s) => s.questionnaireRows)
  const resolveConflict = useAppStore((s) => s.resolveConflict)
  const addToast = useAppStore((s) => s.addToast)

  if (!isOpen || !ceId) return null

  const ce = counterExamples.find((c) => c.id === ceId)
  const evidence: ConflictEvidence | undefined = conflictEvidences.find((e) => e.counterExampleId === ceId)
  const matchingRow: QuestionnaireRow | undefined = ce?.questionnaireRowId
    ? questionnaireRows.find((r) => r.id === ce.questionnaireRowId)
    : undefined

  const conflictingFields = new Set(evidence?.conflictingFields ?? [])

  const handleConfirm = () => {
    resolveConflict(ceId, "confirmed")
    addToast("success", `反例 ${ceId} 已确认`)
    onClose()
  }

  const handleReject = () => {
    resolveConflict(ceId, "rejected")
    addToast("info", `反例 ${ceId} 已驳回`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl border border-[#2a2a5a] bg-[#16163a] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#ccccdd]">冲突证据对比</h2>
          <button onClick={onClose} className="rounded p-1 text-[#666688] hover:bg-[#2a2a5a] hover:text-[#ccccdd]">
            <X size={18} />
          </button>
        </div>

        {!evidence ? (
          <div className="py-12 text-center text-sm text-[#666688]">无冲突证据</div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-4">
              <div className="rounded-lg bg-[#0d0d1f] p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#0ff0b3]">反例数据</h3>
                {[
                  { key: "originalValue", label: "原始值", value: ce?.originalValue },
                  { key: "threshold", label: "阈值", value: ce?.threshold },
                  { key: "deviation", label: "偏差", value: ce?.deviation },
                ].map((item) => (
                  <div key={item.key} className="mb-2 last:mb-0">
                    <span className={cn("text-xs", conflictingFields.has(item.key) ? "text-[#ff9f1c]" : "text-[#666688]")}>
                      {item.label}
                    </span>
                    <p className={cn("text-sm font-mono", conflictingFields.has(item.key) ? "text-[#ff9f1c]" : "text-[#ccccdd]")}>
                      {String(item.value)}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex flex-col items-center justify-center">
                <ArrowRight size={20} className="text-[#ff9f1c]" />
              </div>

              <div className="rounded-lg bg-[#0d0d1f] p-4">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#4488ff]">问卷数据</h3>
                {matchingRow ? (
                  Object.entries(matchingRow.fields).map(([key, value]) => (
                    <div key={key} className="mb-2 last:mb-0">
                      <span className={cn("text-xs", conflictingFields.has(key) ? "text-[#ff9f1c]" : "text-[#666688]")}>
                        {key}
                        {conflictingFields.has(key) && " ⚠"}
                      </span>
                      <p className={cn("text-sm font-mono", conflictingFields.has(key) ? "text-[#ff9f1c]" : "text-[#ccccdd]")}>
                        {String(value)}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[#666688]">无匹配问卷行</p>
                )}
              </div>
            </div>

            <div className="mt-4 rounded-md bg-[#2a1a0a]/40 px-3 py-2">
              <span className="text-xs text-[#ff9f1c]">冲突字段：</span>
              <span className="text-sm font-mono text-[#ff9f1c]">
                {evidence.conflictingFields.join("、")}
              </span>
            </div>

            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={handleConfirm}
                className="flex items-center gap-2 rounded-lg bg-[#0a2a1a] px-4 py-2 text-sm font-medium text-[#0ff0b3] transition-colors hover:bg-[#0ff0b3]/20"
              >
                <Check size={16} />
                确认反例
              </button>
              <button
                onClick={handleReject}
                className="flex items-center gap-2 rounded-lg bg-[#2a1a0a] px-4 py-2 text-sm font-medium text-[#ff9f1c] transition-colors hover:bg-[#ff9f1c]/20"
              >
                <XCircle size={16} />
                驳回反例
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
