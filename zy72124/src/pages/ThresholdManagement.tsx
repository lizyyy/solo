import { useState } from "react"
import { useAppStore } from "@/store/useAppStore"
import { Link } from "react-router-dom"
import { ArrowLeft, Save, GitBranch, Clock, MessageSquare, Shield } from "lucide-react"

export default function ThresholdManagement() {
  const thresholdVersions = useAppStore((s) => s.thresholdVersions)
  const currentThreshold = useAppStore((s) => s.currentThreshold)
  const updateThreshold = useAppStore((s) => s.updateThreshold)

  const [newValue, setNewValue] = useState("")
  const [reason, setReason] = useState("")
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    const val = parseFloat(newValue)
    if (isNaN(val) || val <= 0) return
    if (!reason.trim()) return
    updateThreshold(val, reason.trim())
    setNewValue("")
    setReason("")
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="min-h-screen bg-[#0A1628] text-slate-100">
      <div className="bg-[#0D1B2A] border-b border-slate-700/50 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-[#FF6B35]" />
            <h1 className="text-lg font-bold">阈值管理</h1>
          </div>
          <Link
            to="/"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 border border-slate-700/50 text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            返回看板
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        <div className="p-6 rounded-xl bg-slate-800/40 border border-slate-700/30">
          <h2 className="text-base font-semibold text-slate-200 mb-4">调整安全阈值</h2>
          <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-slate-900/60 border border-slate-700/30">
            <span className="text-xs text-slate-400">当前阈值</span>
            <span className="font-mono text-2xl font-bold text-[#FF6B35]">{currentThreshold.valueKN} kN</span>
            <span className="text-xs text-slate-500">（{currentThreshold.version}）</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">新阈值 (kN)</label>
              <input
                type="number"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="输入新的安全阈值"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/50 text-slate-100 font-mono text-sm placeholder-slate-600 focus:outline-none focus:border-[#FF6B35]/50 focus:ring-1 focus:ring-[#FF6B35]/20"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">变更原因</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="请输入变更原因，此原因将写入阈值版本历史并关联后续计算"
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700/50 text-slate-100 text-sm placeholder-slate-600 focus:outline-none focus:border-[#FF6B35]/50 focus:ring-1 focus:ring-[#FF6B35]/20 resize-none"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={!newValue || !reason.trim() || isNaN(parseFloat(newValue)) || parseFloat(newValue) <= 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium bg-[#FF6B35] text-white hover:bg-[#FF6B35]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-4 h-4" />
              {saved ? "已保存" : "保存新版本"}
            </button>
            {saved && (
              <div className="text-xs text-emerald-400 animate-pulse">
                阈值已更新，后续计算将使用新版本。所有记录已自动重新判断。
              </div>
            )}
          </div>
        </div>

        <div className="p-6 rounded-xl bg-slate-800/40 border border-slate-700/30">
          <h2 className="text-base font-semibold text-slate-200 mb-4">阈值版本历史</h2>
          <div className="space-y-3">
            {[...thresholdVersions].reverse().map((ver, i) => (
              <div
                key={ver.version}
                className={`p-4 rounded-lg border ${
                  i === 0
                    ? "bg-[#FF6B35]/5 border-[#FF6B35]/20"
                    : "bg-slate-900/40 border-slate-700/30"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-slate-500" />
                    <span className="font-mono text-sm font-semibold text-slate-200">{ver.version}</span>
                    {i === 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[#FF6B35]/10 text-[#FF6B35] border border-[#FF6B35]/20">
                        当前
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-lg font-bold text-slate-100">{ver.valueKN} kN</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(ver.changedAt).toLocaleString("zh-CN")}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    {ver.changeReason}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
