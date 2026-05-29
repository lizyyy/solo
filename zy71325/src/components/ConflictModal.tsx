import type { ConflictStrategy } from "@/types"
import { AlertTriangle, SkipForward, RefreshCw, Plus } from "lucide-react"

interface Props {
  fileName: string
  existingFile: string
  onResolve: (strategy: ConflictStrategy) => void
  onCancel: () => void
}

export default function ConflictModal({ fileName, existingFile, onResolve, onCancel }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1A1A35] border border-[#2A2A4A] rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
            <AlertTriangle size={20} className="text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-100">文件冲突</h3>
            <p className="text-xs text-gray-500">检测到相同内容的文件已存在</p>
          </div>
        </div>

        <div className="bg-[#0F0F1A] rounded-lg p-4 mb-5 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded">已有</span>
            <span className="text-sm text-gray-300 font-mono">{existingFile}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded">新导入</span>
            <span className="text-sm text-gray-300 font-mono">{fileName}</span>
          </div>
        </div>

        <p className="text-sm text-gray-400 mb-5">请选择处理方式：</p>

        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => onResolve("skip")}
            className="flex flex-col items-center gap-2 py-3 px-2 rounded-lg bg-[#0F0F1A] border border-[#2A2A4A] hover:border-gray-500 transition-colors"
          >
            <SkipForward size={20} className="text-gray-400" />
            <span className="text-xs text-gray-400">跳过</span>
            <span className="text-[10px] text-gray-600">保留已有文件</span>
          </button>
          <button
            onClick={() => onResolve("overwrite")}
            className="flex flex-col items-center gap-2 py-3 px-2 rounded-lg bg-[#0F0F1A] border border-amber-500/30 hover:border-amber-500/60 transition-colors"
          >
            <RefreshCw size={20} className="text-amber-400" />
            <span className="text-xs text-amber-400">覆盖</span>
            <span className="text-[10px] text-gray-600">替换已有文件</span>
          </button>
          <button
            onClick={() => onResolve("append")}
            className="flex flex-col items-center gap-2 py-3 px-2 rounded-lg bg-[#0F0F1A] border border-emerald-500/30 hover:border-emerald-500/60 transition-colors"
          >
            <Plus size={20} className="text-emerald-400" />
            <span className="text-xs text-emerald-400">追加</span>
            <span className="text-[10px] text-gray-600">同时保留两者</span>
          </button>
        </div>

        <button
          onClick={onCancel}
          className="w-full mt-4 text-xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          取消导入
        </button>
      </div>
    </div>
  )
}
