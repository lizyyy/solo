import { useState } from "react"
import { X, Copy, Check, Download } from "lucide-react"
import { useGradingStore } from "@/store/gradingStore"

interface ExportModalProps {
  open: boolean
  onClose: () => void
}

type ExportFilter = "all" | "pending" | "conclusion_change"

export function ExportModal({ open, onClose }: ExportModalProps) {
  const exportReviewNotes = useGradingStore((s) => s.exportReviewNotes)
  const [filter, setFilter] = useState<ExportFilter>("all")
  const [copied, setCopied] = useState(false)

  if (!open) return null

  const content = exportReviewNotes(filter)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `讲评稿_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filterOptions: { key: ExportFilter; label: string }[] = [
    { key: "all", label: "全部记录" },
    { key: "pending", label: "仅待处理" },
    { key: "conclusion_change", label: "仅改结论" },
  ]

  const pill = (active: boolean) =>
    active
      ? "border-navy-300 bg-navy-100 text-navy-800"
      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="mx-4 flex w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <h3 className="font-serif text-base font-semibold text-navy-800">
            导出讲评稿
          </h3>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-3">
          <div className="flex items-center gap-2">
            {filterOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                className={`inline-flex cursor-pointer items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${pill(filter === opt.key)}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-5 mb-4 max-h-80 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-4 scrollbar-thin">
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-slate-700">
            {content}
          </pre>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3">
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
          >
            <Download size={14} />
            下载
          </button>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-md bg-amber-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-600"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? "已复制" : "复制"}
          </button>
        </div>
      </div>
    </div>
  )
}
