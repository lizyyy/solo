import { useState, useRef, useCallback } from "react"
import { Upload, FileText, X, AlertOctagon, CheckCircle, Loader2 } from "lucide-react"
import { useClusterStore } from "@/store/clusterStore"
import type { ConflictReport } from "@/types"
import { cn } from "@/lib/utils"

export function ConflictModal({
  conflict,
  onResolve,
  onClose,
}: {
  conflict: ConflictReport
  onResolve: (applyNew: boolean) => void
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1a2332] rounded-xl border border-[#2a3444] shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2a3444] flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#f5a623]/20 flex items-center justify-center">
            <AlertOctagon size={20} className="text-[#f5a623]" />
          </div>
          <div>
            <h3 className="font-['Space_Grotesk'] text-sm font-semibold text-[#e8edf5]">标签冲突检测</h3>
            <p className="text-[11px] text-[#8a9aaa] font-['DM_Sans']">合并前需要您确认</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-[#5a6a7a] hover:text-[#e8edf5] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs font-['DM_Sans'] text-[#e8edf5] leading-relaxed mb-4">
            {conflict.detail}
          </p>

          <div className="bg-[#0f1822] rounded-lg p-3 mb-4">
            <div className="text-[10px] font-['DM_Sans'] text-[#8a9aaa] mb-2">冲突详情</div>
            <div className="grid grid-cols-3 gap-2 text-[10px] font-['DM_Sans']">
              <div className="text-[#5a6a7a]">涉及样本</div>
              <div className="col-span-2 text-[#e8edf5] font-mono">
                {conflict.affectedSampleIds.slice(0, 5).join(", ")}
                {conflict.affectedSampleIds.length > 5 && `, 等${conflict.affectedSampleIds.length - 5}个`}
              </div>
              <div className="text-[#5a6a7a] mt-1">涉及列</div>
              <div className="col-span-2 text-[#e8edf5] mt-1">
                {conflict.affectedColumns.join(" ↔ ")}
              </div>
            </div>
          </div>

          <div className="bg-[#0f1822] rounded-lg p-3 mb-4">
            <div className="text-[10px] font-['DM_Sans'] text-[#00f5d4] mb-1.5">⚠️ 重要规则</div>
            <p className="text-[10px] font-['DM_Sans'] text-[#8a9aaa] leading-relaxed">
              已人工修改的标签标记（manuallyModified=true）<span className="text-[#f5a623] font-semibold">不会被自动覆盖</span>，
              仅自动判断有冲突且未修改的标签需要确认。
            </p>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[#2a3444] flex gap-3 justify-end">
          <button
            onClick={() => onResolve(false)}
            className="px-4 py-2 text-xs font-['DM_Sans'] text-[#8a9aaa] hover:text-[#e8edf5] bg-[#0f1822] hover:bg-[#0f1822]/80 rounded-lg transition-colors"
          >
            保留原标签，标记待确认
          </button>
          <button
            onClick={() => onResolve(true)}
            className="px-4 py-2 text-xs font-['DM_Sans'] text-[#0f1822] bg-[#00f5d4] hover:bg-[#00d4b8] rounded-lg font-semibold transition-colors shadow-[0_0_12px_rgba(0,245,212,0.3)]"
          >
            应用新标签
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DataUploader() {
  const [isDragging, setIsDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeConflict, setActiveConflict] = useState<ConflictReport | null>(null)
  const [pendingConflict, setPendingConflict] = useState<ConflictReport | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const loadCSVData = useClusterStore((s) => s.loadCSVData)
  const resolveConflict = useClusterStore((s) => s.resolveConflict)
  const initDemo = useClusterStore((s) => s.initDemo)
  const samples = useClusterStore((s) => s.samples)

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".csv") && !file.name.endsWith(".json")) {
        alert("仅支持 CSV 或 JSON 格式文件")
        return
      }

      setLoading(true)
      try {
        const text = await file.text()
        const conflict = loadCSVData(text, file.name)
        if (conflict) {
          setPendingConflict(conflict)
          setActiveConflict(conflict)
        }
      } catch (e) {
        alert(`文件解析失败: ${e instanceof Error ? e.message : String(e)}`)
      } finally {
        setLoading(false)
      }
    },
    [loadCSVData]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile]
  )

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleResolve = (applyNew: boolean) => {
    if (pendingConflict) {
      resolveConflict(pendingConflict.id, applyNew)
    }
    setActiveConflict(null)
    setPendingConflict(null)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ""
  }

  return (
    <>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          "relative rounded-xl border-2 border-dashed p-4 cursor-pointer transition-all",
          isDragging
            ? "border-[#00f5d4] bg-[#00f5d4]/5 shadow-[0_0_20px_rgba(0,245,212,0.15)]"
            : "border-[#2a3444] hover:border-[#00f5d4]/40 bg-[#1a2332]/50 hover:bg-[#1a2332]"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.json"
          onChange={handleInputChange}
          className="hidden"
        />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-2">
            <Loader2 size={20} className="text-[#00f5d4] animate-spin mb-2" />
            <span className="text-xs font-['DM_Sans'] text-[#8a9aaa]">加载中...</span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                isDragging ? "bg-[#00f5d4]/20" : "bg-[#0f1822]"
              )}
            >
              <Upload size={18} className={cn(isDragging ? "text-[#00f5d4]" : "text-[#00f5d4]")} />
            </div>
            <div className="flex-1">
              <div className="text-xs font-['DM_Sans'] text-[#e8edf5] font-medium">
                {isDragging ? "释放以上传" : "拖拽或点击上传数据"}
              </div>
              <div className="text-[10px] font-['DM_Sans'] text-[#5a6a7a]">
                CSV / JSON · 支持增量加载：样本点、特征列、标签可分批补充
              </div>
            </div>
            {samples.length === 0 ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  initDemo()
                }}
                className="px-3 py-1.5 text-[10px] font-['DM_Sans'] text-[#00f5d4] border border-[#00f5d4]/30 hover:bg-[#00f5d4]/10 rounded-lg transition-colors"
              >
                加载演示数据
              </button>
            ) : (
              <div className="flex items-center gap-1.5 text-[10px] font-['DM_Sans'] text-[#5a6a7a]">
                <CheckCircle size={12} className="text-[#00b894]" />
                {samples.length} 个样本
              </div>
            )}
          </div>
        )}
      </div>

      {activeConflict && (
        <ConflictModal
          conflict={activeConflict}
          onResolve={handleResolve}
          onClose={() => setActiveConflict(null)}
        />
      )}
    </>
  )
}
