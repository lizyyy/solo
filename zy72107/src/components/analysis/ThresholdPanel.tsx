import { useState } from "react"
import { Settings, X } from "lucide-react"
import { useThresholdStore } from "@/store/useThresholdStore"
import { useAuditStore } from "@/store/useAuditStore"

export default function ThresholdPanel() {
  const { versions, currentVersion, getCurrentThreshold, addVersion } = useThresholdStore()
  const { addEntry } = useAuditStore()
  const [isEditing, setIsEditing] = useState(false)
  const [newMaxValue, setNewMaxValue] = useState("")
  const [operatorName, setOperatorName] = useState("")
  const [reason, setReason] = useState("")

  const current = getCurrentThreshold()

  const handleSubmit = () => {
    const value = parseFloat(newMaxValue)
    if (isNaN(value) || value <= 0) return
    if (!operatorName.trim()) return

    const oldMax = current.maxValue.toString()
    addVersion(value, operatorName.trim(), reason.trim() || "未填写")
    addEntry({
      action: "修改阈值",
      target: `阈值版本 v${currentVersion}`,
      oldValue: oldMax,
      newValue: value.toString(),
      operator: operatorName.trim(),
      reason: reason.trim() || "未填写",
    })

    setNewMaxValue("")
    setOperatorName("")
    setReason("")
    setIsEditing(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-coffee-800">阈值管理</h3>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-1 text-xs text-coffee-500 hover:text-coffee-700 transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            修改阈值
          </button>
        )}
      </div>

      <div className="bg-coffee-50 rounded-md p-3 flex items-center gap-3">
        <span className="badge bg-blue-100 border-blue-200 text-blue-700">v{current.version}</span>
        <div className="flex-1">
          <div className="text-xs text-coffee-400">当前最高阈值</div>
          <div className="text-lg font-mono font-semibold text-coffee-800">
            {current.maxValue}{current.unit}
          </div>
        </div>
        <div className="text-right text-[10px] text-coffee-400">
          <div>{current.changedBy}</div>
          <div>{current.changedAt}</div>
        </div>
      </div>

      {isEditing && (
        <div className="border border-coffee-200 rounded-md p-3 space-y-2.5 bg-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-coffee-700">新增阈值版本</span>
            <button onClick={() => setIsEditing(false)} className="text-coffee-400 hover:text-coffee-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div>
            <label className="text-[11px] text-coffee-500 block mb-1">新阈值 (°C)</label>
            <input
              type="number"
              value={newMaxValue}
              onChange={(e) => setNewMaxValue(e.target.value)}
              placeholder="例: 260"
              className="w-full border border-coffee-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-coffee-400"
            />
          </div>
          <div>
            <label className="text-[11px] text-coffee-500 block mb-1">操作人</label>
            <input
              type="text"
              value={operatorName}
              onChange={(e) => setOperatorName(e.target.value)}
              placeholder="姓名"
              className="w-full border border-coffee-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-coffee-400"
            />
          </div>
          <div>
            <label className="text-[11px] text-coffee-500 block mb-1">原因</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="修改原因..."
              rows={2}
              className="w-full border border-coffee-200 rounded px-2.5 py-1.5 text-xs focus:outline-none focus:border-coffee-400 resize-none"
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={!newMaxValue || !operatorName.trim()}
            className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed text-xs py-1.5"
          >
            提交新版本
          </button>
        </div>
      )}

      <div className="space-y-1.5 max-h-40 overflow-y-auto">
        {[...versions].reverse().map((v) => {
          const isCurrent = v.version === currentVersion
          return (
            <div
              key={v.version}
              className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-xs ${
                isCurrent
                  ? "bg-blue-50 border border-blue-100"
                  : "bg-gray-50 border border-gray-100 opacity-60"
              }`}
            >
              <span
                className={`badge ${
                  isCurrent
                    ? "bg-blue-100 border-blue-200 text-blue-700"
                    : "bg-gray-100 border-gray-200 text-gray-500"
                }`}
              >
                v{v.version}
              </span>
              <span className={`font-mono ${isCurrent ? "text-coffee-800" : "text-gray-500"}`}>
                {v.maxValue}{v.unit}
              </span>
              <span className={`flex-1 text-right text-[10px] ${isCurrent ? "text-blue-500" : "text-gray-400"}`}>
                {v.changedBy} · {v.changedAt}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
