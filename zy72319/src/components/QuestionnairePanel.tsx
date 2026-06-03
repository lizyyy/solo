import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { QuestionnaireRow } from "@/types"
import useAppStore from "@/store/useAppStore"

interface QuestionnairePanelProps {
  ceId: string | null
  onClose: () => void
}

export default function QuestionnairePanel({ ceId, onClose }: QuestionnairePanelProps) {
  const counterExamples = useAppStore((s) => s.counterExamples)
  const questionnaireRows = useAppStore((s) => s.questionnaireRows)
  const conflictEvidences = useAppStore((s) => s.conflictEvidences)

  const selectedCE = counterExamples.find((ce) => ce.id === ceId)
  const matchingRow: QuestionnaireRow | undefined = selectedCE?.questionnaireRowId
    ? questionnaireRows.find((r) => r.id === selectedCE.questionnaireRowId)
    : undefined

  const conflict = conflictEvidences.find((ev) => ev.counterExampleId === ceId)
  const conflictingFields = new Set(conflict?.conflictingFields ?? [])

  if (!ceId) return null

  return (
    <div className="fixed right-0 top-0 z-40 flex h-full w-80 flex-col border-l border-[#2a2a5a] bg-[#16163a] shadow-2xl">
      <div className="flex items-center justify-between border-b border-[#2a2a5a] px-4 py-3">
        <h3 className="text-sm font-semibold text-[#ccccdd]">问卷行数据</h3>
        <button
          onClick={onClose}
          className="rounded p-1 text-[#666688] transition-colors hover:bg-[#2a2a5a] hover:text-[#ccccdd]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!matchingRow ? (
          <div className="flex h-full items-center justify-center text-sm text-[#666688]">
            无匹配问卷行
          </div>
        ) : (
          <div className="space-y-3">
            <div className="mb-3 rounded-md bg-[#0d0d1f] px-3 py-2">
              <span className="text-xs text-[#666688]">行号</span>
              <p className="mt-0.5 text-sm font-mono text-[#0ff0b3]">{matchingRow.id}</p>
            </div>
            {Object.entries(matchingRow.fields).map(([key, value]) => {
              const isDifferent = conflictingFields.has(key)
              return (
                <div
                  key={key}
                  className={cn(
                    "rounded-md px-3 py-2",
                    isDifferent ? "bg-[#2a1a0a]/50 ring-1 ring-[#ff9f1c]/30" : "bg-[#0d0d1f]"
                  )}
                >
                  <span className={cn("text-xs", isDifferent ? "text-[#ff9f1c]" : "text-[#666688]")}>
                    {key}
                    {isDifferent && " ⚠"}
                  </span>
                  <p className={cn("mt-0.5 text-sm", isDifferent ? "text-[#ff9f1c]" : "text-[#ccccdd]")}>
                    {String(value)}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
