import { FileSearch, AlertTriangle, Clock, ShieldCheck } from "lucide-react"
import useAppStore from "@/store/useAppStore"

export default function StatusCards() {
  const counterExamples = useAppStore((s) => s.counterExamples)
  const conflictEvidences = useAppStore((s) => s.conflictEvidences)
  const selfCheckResults = useAppStore((s) => s.selfCheckResults)

  const total = counterExamples.length
  const conflictCount = counterExamples.filter((c) => c.status === "conflict").length
  const pendingCount = counterExamples.filter((c) => c.status === "pending_review").length
  const checkPassRate = selfCheckResults.length > 0
    ? Math.round((selfCheckResults.filter((r) => r.passed).length / selfCheckResults.length) * 100)
    : -1

  const cards = [
    { icon: FileSearch, label: "反例总数", value: total, color: "#0ff0b3", bg: "bg-[#0a2a1a]" },
    { icon: AlertTriangle, label: "冲突数", value: conflictCount, color: "#ff9f1c", bg: "bg-[#2a1a0a]" },
    { icon: Clock, label: "待复核", value: pendingCount, color: "#4488ff", bg: "bg-[#0a1a2a]" },
    { icon: ShieldCheck, label: "自检通过率", value: checkPassRate >= 0 ? `${checkPassRate}%` : "--", color: checkPassRate >= 0 ? (checkPassRate === 100 ? "#0ff0b3" : "#ff9f1c") : "#8888aa", bg: checkPassRate >= 0 ? (checkPassRate === 100 ? "bg-[#0a2a1a]" : "bg-[#2a1a0a]") : "bg-[#16163a]" },
  ]

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className={`${card.bg} rounded-xl border border-[#2a2a4a] px-5 py-4 flex flex-col gap-2`}>
          <div className="flex items-center gap-2">
            <card.icon size={16} style={{ color: card.color }} />
            <span className="text-xs text-[#8888aa]">{card.label}</span>
          </div>
          <span className="text-2xl font-bold font-mono" style={{ color: card.color }}>{card.value}</span>
        </div>
      ))}
    </div>
  )
}
