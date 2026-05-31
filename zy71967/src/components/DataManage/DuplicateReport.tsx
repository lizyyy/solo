import { X, AlertTriangle, SkipForward, RotateCcw, FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface DuplicateReportProps {
  open: boolean
  onClose: () => void
  duplicates: { fileName: string; importedAt: string; importedBy: string }[]
  onAction: (action: "overwrite" | "skip" | "rollback") => void
}

export default function DuplicateReport({ open, onClose, duplicates, onAction }: DuplicateReportProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-md bg-slate-900 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-400" />
            <h3 className="text-sm font-medium text-slate-100">检测到重复数据</h3>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 max-h-52 overflow-y-auto rounded bg-slate-800 p-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="pb-2 text-left font-medium">文件名</th>
                <th className="pb-2 text-left font-medium">导入时间</th>
                <th className="pb-2 text-left font-medium">操作人</th>
              </tr>
            </thead>
            <tbody>
              {duplicates.map((d, i) => (
                <tr key={i} className="border-t border-slate-700/50">
                  <td className="py-2 text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5 text-slate-500" />
                      {d.fileName}
                    </span>
                  </td>
                  <td className="py-2 text-slate-400">{d.importedAt}</td>
                  <td className="py-2 text-slate-400">{d.importedBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mb-4 text-xs text-slate-400">
          同一实验下已存在相同来源的数据源，请选择处理方式：
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => onAction("overwrite")}
            className={cn(
              "flex-1 rounded px-3 py-2 text-xs font-medium transition-colors",
              "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
            )}
          >
            覆盖
          </button>
          <button
            onClick={() => onAction("skip")}
            className={cn(
              "flex-1 rounded px-3 py-2 text-xs font-medium transition-colors",
              "flex items-center justify-center gap-1.5",
              "bg-slate-700/50 text-slate-300 hover:bg-slate-700"
            )}
          >
            <SkipForward className="h-3.5 w-3.5" />
            跳过
          </button>
          <button
            onClick={() => onAction("rollback")}
            className={cn(
              "flex-1 rounded px-3 py-2 text-xs font-medium transition-colors",
              "flex items-center justify-center gap-1.5",
              "bg-red-500/20 text-red-400 hover:bg-red-500/30"
            )}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            撤回修正
          </button>
        </div>
      </div>
    </div>
  )
}
