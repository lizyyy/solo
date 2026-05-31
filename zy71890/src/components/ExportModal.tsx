import { useState } from "react"
import { useInspectionStore } from "@/store/useInspectionStore"
import { X, CheckCircle, AlertTriangle, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface ExportModalProps {
  open: boolean
  onClose: () => void
}

export default function ExportModal({ open, onClose }: ExportModalProps) {
  const { getTimelineEvents, validationIssues, handlingTags } = useInspectionStore()
  const [checks, setChecks] = useState({
    noPending: false,
    noDuplicates: false,
    allTagged: false,
    reviewed: false,
  })

  if (!open) return null

  const events = getTimelineEvents()
  const pendingCount = events.filter((e) => e.data.status === "pending").length
  const duplicateIssues = validationIssues.filter((i) => i.issueType === "duplicate")
  const untaggedCount = events.filter((e) => !handlingTags[e.data.id]).length

  const checklistItems = [
    {
      id: "noPending" as const,
      label: `待补记录已处理（当前 ${pendingCount} 条待补）`,
      ok: pendingCount === 0,
    },
    {
      id: "noDuplicates" as const,
      label: `重复项已排除（当前 ${duplicateIssues.length} 条重复）`,
      ok: duplicateIssues.length === 0,
    },
    {
      id: "allTagged" as const,
      label: `所有记录已标注处理口径（${untaggedCount} 条未标注）`,
      ok: untaggedCount === 0,
    },
    {
      id: "reviewed" as const,
      label: "已人工复核报告内容",
      ok: checks.reviewed,
    },
  ]

  const allChecked = Object.values(checks).every(Boolean)

  function handleExport() {
    const reportData = {
      exportTime: new Date().toLocaleString("zh-CN"),
      totalRecords: events.length,
      confirmed: events.filter((e) => e.data.status === "confirmed").length,
      pending: pendingCount,
      manualCorrected: events.filter((e) => e.data.status === "manual_corrected").length,
      records: events.map((e) => ({
        id: e.data.id,
        type: e.type,
        status: e.data.status,
        handlingTag: handlingTags[e.data.id],
      })),
    }
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `巡检报告_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-800">导出前复核</h3>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">
          <p className="mb-4 text-sm text-slate-600">导出报告前，请逐项确认以下内容：</p>
          <div className="space-y-3">
            {checklistItems.map((item) => (
              <label
                key={item.id}
                className={cn(
                  "flex items-start gap-3 rounded-md border p-3 transition-colors",
                  checks[item.id] ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white"
                )}
              >
                <input
                  type="checkbox"
                  checked={checks[item.id]}
                  onChange={(e) => setChecks((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-800"
                />
                <div className="flex-1">
                  <span className="text-sm text-slate-700">{item.label}</span>
                  <div className="mt-0.5">
                    {item.ok ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle className="h-3 w-3" /> 通过
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                        <AlertTriangle className="h-3 w-3" /> 待处理
                      </span>
                    )}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-md border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
          >
            取消
          </button>
          <button
            onClick={handleExport}
            disabled={!allChecked}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition-colors",
              allChecked
                ? "bg-slate-800 hover:bg-slate-700"
                : "cursor-not-allowed bg-slate-300"
            )}
          >
            <FileText className="h-4 w-4" />
            导出报告
          </button>
        </div>
      </div>
    </div>
  )
}
