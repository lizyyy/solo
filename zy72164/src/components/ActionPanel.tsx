import { useState } from "react"
import { CheckCircle, Clock, AlertTriangle } from "lucide-react"
import { useAlertStore } from "@/store/alertStore"
import type { ProcessAction } from "@/types/alert"

const actions: { action: ProcessAction; label: string; icon: React.ReactNode; color: string; hoverBg: string }[] = [
  { action: "confirmed", label: "确认已处理", icon: <CheckCircle size={16} />, color: "#10b981", hoverBg: "hover:bg-[#10b981]/20" },
  { action: "marked_pending", label: "标记待核实", icon: <Clock size={16} />, color: "#f59e0b", hoverBg: "hover:bg-[#f59e0b]/20" },
  { action: "marked_recheck", label: "标记需现场复看", icon: <AlertTriangle size={16} />, color: "#ef4444", hoverBg: "hover:bg-[#ef4444]/20" },
]

export default function ActionPanel({ alertId }: { alertId: string }) {
  const [opinion, setOpinion] = useState("")
  const [selectedAction, setSelectedAction] = useState<ProcessAction | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const addProcessRecord = useAlertStore((s) => s.addProcessRecord)

  async function handleSubmit() {
    if (!selectedAction) return
    setSubmitting(true)
    addProcessRecord(alertId, selectedAction, opinion)
    setOpinion("")
    setSelectedAction(null)
    setSubmitting(false)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#1a1a2e] border-t border-white/10 px-4 py-3 z-50">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          {actions.map(({ action, label, icon, color, hoverBg }) => (
            <button
              key={action}
              onClick={() => setSelectedAction(selectedAction === action ? null : action)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all ${hoverBg} ${
                selectedAction === action ? "border-current" : "border-white/10"
              }`}
              style={{
                color: selectedAction === action ? color : "#9ca3af",
                backgroundColor: selectedAction === action ? `${color}15` : "transparent",
                borderColor: selectedAction === action ? color : "rgba(255,255,255,0.1)",
              }}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={opinion}
            onChange={(e) => setOpinion(e.target.value)}
            placeholder="输入处理意见..."
            className="flex-1 bg-[#0f0f1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#4a90d9]/50"
          />
          <button
            onClick={handleSubmit}
            disabled={!selectedAction || submitting}
            className="px-5 py-2 rounded-lg text-sm font-medium bg-[#4a90d9] text-white hover:bg-[#4a90d9]/80 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            提交
          </button>
        </div>
      </div>
    </div>
  )
}
