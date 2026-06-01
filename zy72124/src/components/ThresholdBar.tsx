import { useAppStore } from "@/store/useAppStore"
import { Shield, GitBranch } from "lucide-react"

export function ThresholdBar() {
  const currentThreshold = useAppStore((s) => s.currentThreshold)

  return (
    <div className="bg-[#0D1B2A] border-b border-slate-700/50 px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#FF6B35]" />
            <span className="text-xs text-slate-400">当前安全阈值</span>
            <span className="font-mono text-lg font-bold text-[#FF6B35]">
              {currentThreshold.valueKN} kN
            </span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <GitBranch className="w-3 h-3 text-slate-500" />
            <span className="text-xs text-slate-400">版本</span>
            <span className="font-mono text-xs text-slate-300">{currentThreshold.version}</span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <div className="text-xs text-slate-500">
            最后变更：{new Date(currentThreshold.changedAt).toLocaleString("zh-CN")}
          </div>
        </div>
        <div className="text-xs text-slate-600">
          {currentThreshold.changeReason}
        </div>
      </div>
    </div>
  )
}
