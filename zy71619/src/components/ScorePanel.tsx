import { useGameStore } from "@/store/gameStore"
import { Lightbulb, Trophy, AlertTriangle, Clock } from "lucide-react"
import { COLORS } from "@/utils/colors"

const RADIUS = 40
const STROKE_WIDTH = 8
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function getGaugeColor(percent: number): string {
  if (percent < 50) {
    const t = percent / 50
    const r = Math.round(255)
    const g = Math.round(107 + (180 - 107) * t)
    const b = Math.round(53 + (0 - 53) * t)
    return `rgb(${r}, ${g}, ${b})`
  } else {
    const t = (percent - 50) / 50
    const r = Math.round(255 - 255 * t)
    const g = Math.round(180 + (212 - 180) * t)
    const b = Math.round(0 + (170 - 0) * t)
    return `rgb(${r}, ${g}, ${b})`
  }
}

export default function ScorePanel() {
  const { score, isComplete } = useGameStore()
  const { total, maxScore, matchPercent, deductions, keyChoices, suggestions } = score

  const offset = CIRCUMFERENCE - (matchPercent / 100) * CIRCUMFERENCE
  const gaugeColor = getGaugeColor(matchPercent)

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: COLORS.cardBg,
        border: `1px solid ${COLORS.cardBorder}`,
      }}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="relative flex items-center justify-center">
          <svg width={120} height={120} viewBox="0 0 120 120">
            <circle
              cx={60}
              cy={60}
              r={RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={STROKE_WIDTH}
            />
            <circle
              cx={60}
              cy={60}
              r={RADIUS}
              fill="none"
              stroke={gaugeColor}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              transform="rotate(-90 60 60)"
              style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.4s ease" }}
            />
          </svg>
          <span
            className="absolute text-2xl font-bold"
            style={{ color: gaugeColor }}
          >
            {Math.round(matchPercent)}%
          </span>
        </div>

        <div className="text-sm" style={{ color: COLORS.textSecondary }}>
          得分: {total} / {maxScore}
        </div>

        {isComplete && (
          <div
            className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold"
            style={{
              background: "linear-gradient(135deg, #FDCB6E 0%, #FF6B35 100%)",
              color: "#0A2540",
              boxShadow: "0 0 20px rgba(253, 203, 110, 0.5), 0 0 40px rgba(253, 203, 110, 0.2)",
            }}
          >
            <Trophy size={16} />
            关卡完成
          </div>
        )}

        {deductions.length > 0 && (
          <div className="w-full">
            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold" style={{ color: COLORS.dangerRed }}>
              <AlertTriangle size={14} />
              扣分项
            </div>
            <div className="flex flex-col gap-1.5">
              {deductions.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-xs"
                  style={{
                    background: "rgba(255, 71, 87, 0.08)",
                    borderLeft: `3px solid ${COLORS.dangerRed}`,
                    color: COLORS.textPrimary,
                  }}
                >
                  <span className="truncate mr-2">{d.reason}</span>
                  <span className="shrink-0 font-semibold" style={{ color: COLORS.dangerRed }}>
                    -{d.points}分
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {keyChoices.length > 0 && (
          <div className="w-full">
            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold" style={{ color: COLORS.yellow }}>
              <Clock size={14} />
              关键选择
            </div>
            <div className="flex flex-col gap-1.5">
              {keyChoices.map((kc, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg px-3 py-2 text-xs"
                  style={{
                    background: "rgba(253, 203, 110, 0.06)",
                    borderLeft: `3px solid ${COLORS.yellow}`,
                    color: COLORS.textPrimary,
                  }}
                >
                  <span className="truncate mr-2">{kc.description}</span>
                  <span className="shrink-0" style={{ color: COLORS.textMuted }}>
                    {new Date(kc.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="w-full">
            <div className="flex items-center gap-1.5 mb-2 text-xs font-semibold" style={{ color: COLORS.waveTeal }}>
              <Lightbulb size={14} />
              建议
            </div>
            <div className="flex flex-col gap-1.5">
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded-full px-3 py-1.5 text-xs"
                  style={{
                    background: "rgba(0, 212, 170, 0.12)",
                    color: COLORS.waveTeal,
                  }}
                >
                  <Lightbulb size={12} className="shrink-0 mt-0.5" />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
