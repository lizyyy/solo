import { X, AlertTriangle, Clock } from "lucide-react"
import { useStore } from "@/store/useStore"
import { FILE_TYPE_LABELS } from "@/types"

export default function FileDetailPanel() {
  const { selectedFileId, selectedRecordId, records, sidePanelOpen, closeSidePanel } = useStore()

  const record = records.find((r) => r.id === selectedRecordId)
  const file = record?.linkedFiles.find((f) => f.id === selectedFileId)

  return (
    <div
      className="fixed top-0 right-0 h-full w-[380px] bg-white border-l border-[var(--color-border)] shadow-[-4px_0_16px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-in-out z-50"
      style={{
        transform: sidePanelOpen ? "translateX(0)" : "translateX(100%)",
      }}
    >
      {file && record && (
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
            <span className="text-sm font-medium text-[var(--color-accent)]">
              {FILE_TYPE_LABELS[file.type]}
            </span>
            <button
              onClick={closeSidePanel}
              className="p-1 rounded-md hover:bg-gray-100 transition-colors"
            >
              <X size={18} className="text-[var(--color-muted)]" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            <div>
              <h2 className="text-base font-semibold text-[var(--color-text)] leading-snug">
                {file.name}
              </h2>
              <div className="flex items-center gap-1.5 mt-2 text-sm text-[var(--color-muted)]">
                <Clock size={14} />
                <span>上传于 {file.uploadDate}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {file.isLateArrival && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium status-pending border">
                  <Clock size={12} />
                  晚到附件
                </span>
              )}
              {file.isDuplicate && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium status-manual_corrected border">
                  <AlertTriangle size={12} />
                  重复项
                </span>
              )}
            </div>

            {record.correctionNote && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-amber-800 leading-relaxed">
                    {record.correctionNote}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-[var(--color-border)]">
            <button
              onClick={closeSidePanel}
              className="text-sm text-[var(--color-accent)] hover:underline"
            >
              返回排期记录
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
