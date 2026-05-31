import { useState } from "react"
import { X, RotateCcw, FileText } from "lucide-react"
import { useAppStore } from "@/store/useAppStore"
import { SOURCE_LABELS, type DataSource } from "@/types"
import { cn } from "@/lib/utils"

interface RollbackModalProps {
  open: boolean
  onClose: () => void
  dataSource: DataSource | null
}

export default function RollbackModal({ open, onClose, dataSource }: RollbackModalProps) {
  const { rollbackDataSource, addOperationLog } = useAppStore()
  const [reason, setReason] = useState("")

  if (!open || !dataSource) return null

  const handleConfirm = () => {
    rollbackDataSource(dataSource.id)
    addOperationLog({
      id: `ol-${Date.now()}`,
      experimentId: dataSource.experimentId,
      action: "rollback",
      operator: "当前用户",
      timestamp: new Date().toLocaleString("zh-CN"),
      detail: `撤回${SOURCE_LABELS[dataSource.type]}：${dataSource.fileName}${reason ? `，原因：${reason}` : ""}`,
    })
    setReason("")
    onClose()
  }

  const handleClose = () => {
    setReason("")
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
      <div className="relative w-full max-w-md rounded-md bg-slate-900 p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-red-400" />
            <h3 className="text-sm font-medium text-slate-100">撤回数据源</h3>
          </div>
          <button onClick={handleClose} className="text-slate-500 hover:text-slate-300">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 rounded bg-slate-800 p-3">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <FileText className="h-4 w-4 text-slate-500" />
            <span className="font-medium">{dataSource.fileName}</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>来源类型：{SOURCE_LABELS[dataSource.type]}</span>
            <span>导入时间：{dataSource.importedAt}</span>
            <span>操作人：{dataSource.importedBy}</span>
            <span>状态：{dataSource.rolledBack ? "已撤回" : "正常"}</span>
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-medium text-slate-400">撤回原因</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="请输入撤回原因（可选）"
            rows={3}
            className="w-full rounded bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={handleClose}
            className="rounded px-4 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className={cn(
              "rounded px-4 py-2 text-xs font-medium transition-colors",
              "bg-red-500/20 text-red-400 hover:bg-red-500/30"
            )}
          >
            确认撤回
          </button>
        </div>
      </div>
    </div>
  )
}
