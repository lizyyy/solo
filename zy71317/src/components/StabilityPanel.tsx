import type { StabilityResult } from "@/types"
import { STATUS_LABELS } from "@/types"
import { Shield, ShieldAlert, ShieldOff } from "lucide-react"

interface Props {
  result: StabilityResult | null
}

const STATUS_CONFIG: Record<
  StabilityResult["status"],
  { color: string; bg: string; border: string; icon: React.ReactNode }
> = {
  stable: {
    color: "text-[#00E5CC]",
    bg: "bg-[#00E5CC]/10",
    border: "border-[#00E5CC]/30",
    icon: <Shield size={18} />,
  },
  critical: {
    color: "text-[#FFD700]",
    bg: "bg-[#FFD700]/10",
    border: "border-[#FFD700]/30",
    icon: <ShieldAlert size={18} />,
  },
  unstable: {
    color: "text-[#FF4444]",
    bg: "bg-[#FF4444]/10",
    border: "border-[#FF4444]/30",
    icon: <ShieldOff size={18} />,
  },
}

export default function StabilityPanel({ result }: Props) {
  if (!result) {
    return (
      <div className="bg-[#0D1F3C] rounded-xl p-4 border border-[#1A3A5C]">
        <p className="text-[#556677] text-sm text-center">调节参数后显示判别结果</p>
      </div>
    )
  }

  const cfg = STATUS_CONFIG[result.status]

  return (
    <div className={`rounded-xl p-4 border ${cfg.bg} ${cfg.border} space-y-3`}>
      <div className="flex items-center justify-between">
        <h3 className={`font-semibold text-sm tracking-wider uppercase flex items-center gap-2 ${cfg.color}`}>
          {cfg.icon}
          稳定判别
        </h3>
        <span
          className={`px-3 py-1 rounded-full text-xs font-bold ${cfg.bg} ${cfg.color} border ${cfg.border}`}
        >
          {STATUS_LABELS[result.status]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <MetricRow label="磁力 F" value={`${result.magneticForce.toFixed(6)} N`} />
        <MetricRow label="重力 G" value={`${result.gravityForce.toFixed(6)} N`} />
        <MetricRow label="净力" value={`${result.netForce.toFixed(6)} N`} />
        <MetricRow label="F/G 比值" value={result.ratio.toFixed(4)} highlight />
        <MetricRow label="振荡幅度" value={`${result.oscillationAmplitude.toFixed(2)} mm`} />
      </div>

      <div className="text-[10px] text-[#556677] border-t border-[#1A3A5C] pt-2 space-y-0.5">
        <div>判据：F/G &gt; 1.2 → 稳定 | 0.8~1.2 → 临界 | &lt; 0.8 → 不稳定</div>
        <div>公式：F = μ₀·m₁·m₂ / (4π·d³)</div>
      </div>
    </div>
  )
}

function MetricRow({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex justify-between items-center py-1 px-2 rounded bg-[#0A1628]/50">
      <span className="text-[#8899AA]">{label}</span>
      <span
        className={`font-mono ${highlight ? "text-[#00E5CC] font-bold" : "text-white"}`}
      >
        {value}
      </span>
    </div>
  )
}
