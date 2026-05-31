import type { ValidationIssue } from "@/types"
import { CheckCircle, AlertTriangle, XCircle, Pencil } from "lucide-react"
import { cn } from "@/lib/utils"

const issueIcons: Record<string, React.ReactNode> = {
  normal: <CheckCircle className="h-4 w-4 text-emerald-500" />,
  late_attachment: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  duplicate: <XCircle className="h-4 w-4 text-red-500" />,
  manual_correction: <Pencil className="h-4 w-4 text-violet-500" />,
}

const issueBorder: Record<string, string> = {
  normal: "border-l-emerald-400",
  late_attachment: "border-l-amber-400",
  duplicate: "border-l-red-400",
  manual_correction: "border-l-violet-400",
}

const issueBg: Record<string, string> = {
  normal: "bg-emerald-50/50",
  late_attachment: "bg-amber-50/50",
  duplicate: "bg-red-50/50",
  manual_correction: "bg-violet-50/50",
}

interface ValidationResultListProps {
  issues: ValidationIssue[]
}

export default function ValidationResultList({ issues }: ValidationResultListProps) {
  const sorted = [...issues].sort((a, b) => {
    const order = { duplicate: 0, late_attachment: 1, manual_correction: 2, normal: 3 }
    return (order[a.issueType] ?? 4) - (order[b.issueType] ?? 4)
  })

  return (
    <div className="space-y-2">
      {sorted.map((issue) => (
        <div
          key={`${issue.recordId}-${issue.issueType}`}
          className={cn(
            "flex items-start gap-3 rounded-md border-l-4 bg-white p-3 shadow-sm",
            issueBorder[issue.issueType],
            issue.issueType !== "normal" && issueBg[issue.issueType]
          )}
        >
          <div className="mt-0.5 flex-shrink-0">{issueIcons[issue.issueType]}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-slate-500">{issue.recordId}</span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-500">
                {issue.recordType === "condition" ? "工况日志" : issue.recordType === "threshold" ? "阈值触发" : "维修单"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-700">{issue.message}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
