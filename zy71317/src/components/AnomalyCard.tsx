import type { StabilityResult, AnomalyType } from "@/types"
import { ANOMALY_LABELS } from "@/types"
import { AlertTriangle, Zap, Ruler, Waves } from "lucide-react"

interface Props {
  result: StabilityResult | null
}

const ANOMALY_ICONS: Record<AnomalyType, React.ReactNode> = {
  current_exceed: <Zap size={16} />,
  negative_spacing: <Ruler size={16} />,
  oscillation_diverge: <Waves size={16} />,
}

const ANOMALY_COLORS: Record<AnomalyType, string> = {
  current_exceed: "text-yellow-400",
  negative_spacing: "text-red-400",
  oscillation_diverge: "text-orange-400",
}

export default function AnomalyCard({ result }: Props) {
  if (!result?.anomalyType) return null

  const type = result.anomalyType
  const icon = ANOMALY_ICONS[type]
  const color = ANOMALY_COLORS[type]
  const label = ANOMALY_LABELS[type]
  const reason = result.anomalyReason || "未知异常"

  return (
    <div className="bg-[#1A0A0A] border-l-4 border-red-500 rounded-r-xl p-4 space-y-2 animate-fade-in">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-red-400" />
        <span className="text-red-400 font-semibold text-sm">异常检测</span>
      </div>

      <div className="flex items-center gap-2">
        <span className={color}>{icon}</span>
        <span className={`font-bold text-sm ${color}`}>{label}</span>
      </div>

      <p className="text-[#CC8888] text-xs leading-relaxed">{reason}</p>

      <div className="text-[10px] text-[#664444] pt-1 border-t border-red-900/30">
        异常类型: {type} | 时间: {new Date().toLocaleTimeString()}
      </div>
    </div>
  )
}
