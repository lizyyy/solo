import { useGameStore } from "@/store/gameStore"
import { AlertTriangle, Check, RotateCcw, Scale, ArrowRight, X } from "lucide-react"
import { COLORS } from "@/utils/colors"
import { getExceptionLabel, getExceptionDescription } from "@/engine/exceptions"

function getExceptionIcon(type: string) {
  switch (type) {
    case "PHASE_UNIT_ERROR":
      return "📐"
    case "AMPLITUDE_OVERFLOW":
      return "⚡"
    case "BOUNDARY_CROSSING":
      return "🚧"
    default:
      return "⚠️"
  }
}

export default function ExceptionPanel() {
  const { activeException, resolveActiveException, dismissActiveException } = useGameStore()

  if (!activeException) return null

  const label = getExceptionLabel(activeException.type)
  const description = getExceptionDescription(activeException)
  const icon = getExceptionIcon(activeException.type)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(5, 14, 26, 0.85)" }}>
      <div
        className="w-full max-w-lg rounded-2xl p-6 shadow-2xl"
        style={{
          background: COLORS.cardBg,
          border: `1px solid ${COLORS.cardBorder}`,
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{icon}</span>
            <div>
              <h3 className="text-lg font-bold" style={{ color: COLORS.textPrimary }}>
                {label}
              </h3>
              <p className="text-sm mt-0.5" style={{ color: COLORS.textSecondary }}>
                {description}
              </p>
            </div>
          </div>
          <button
            onClick={dismissActiveException}
            className="p-1.5 rounded-lg hover:opacity-70"
            style={{ color: COLORS.textMuted }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          className="mb-5 rounded-xl p-4"
          style={{
            background: "rgba(255, 255, 255, 0.04)",
            border: `1px solid ${COLORS.cardBorder}`,
          }}
        >
          <div className="text-xs font-semibold mb-2" style={{ color: COLORS.textSecondary }}>
            当前值:
          </div>
          <div className="text-sm" style={{ color: COLORS.textPrimary }}>
            <span className="font-mono text-xs">{activeException.context.currentValue.toFixed(2)}</span>
            <span className="ml-2 text-xs" style={{ color: COLORS.textMuted }}>
              (预期范围: [{activeException.context.expectedRange[0].toFixed(2)}, {activeException.context.expectedRange[1].toFixed(2)}]
            </span>
          </div>
          {activeException.type === "AMPLITUDE_OVERFLOW" && (
            <div className="mt-3 text-xs" style={{ color: COLORS.textMuted }}>
              <div className="font-semibold mb-1">各分量贡献:</div>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {activeException.context.allWaveCards.map((card, i) => (
                  <span
                    key={card.id}
                    className="px-2 py-0.5 rounded-full text-xs"
                    style={{ background: card.color + "20", color: card.color }}
                  >
                    #{i + 1}: {card.amplitude.toFixed(1)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {activeException.type === "PHASE_UNIT_ERROR" && (
            <>
              <button
                onClick={() => resolveActiveException("AUTO_FIXED", "switchUnit")}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium"
                style={{ background: COLORS.waveTeal }}
              >
                <Scale size={16} />
                切换为角度模式
              </button>
              <button
                onClick={() => resolveActiveException("AUTO_FIXED", "autoWrap")}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
                style={{
                  background: "transparent",
                  border: `1px solid ${COLORS.cardBorder}`,
                  color: COLORS.textPrimary,
                }}
              >
                <RotateCcw size={16} />
                自动映射到 [0, 2π)
              </button>
            </>
          )}

          {activeException.type === "AMPLITUDE_OVERFLOW" && (
            <>
              <button
                onClick={() => resolveActiveException("AUTO_FIXED", "scaleDown")}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium"
                style={{ background: COLORS.waveTeal }}
              >
                <Scale size={16} />
                等比缩放至安全范围
              </button>
              <button
                onClick={() => resolveActiveException("MANUAL_FIXED")}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
                style={{
                  background: "transparent",
                  border: `1px solid ${COLORS.cardBorder}`,
                  color: COLORS.textPrimary,
                }}
              >
                <ArrowRight size={16} />
                手动调整各分量
              </button>
            </>
          )}

          {activeException.type === "BOUNDARY_CROSSING" && (
            <>
              <button
                onClick={() => resolveActiveException("AUTO_FIXED")}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium"
                style={{ background: COLORS.waveTeal }}
              >
                <RotateCcw size={16} />
                弹回边界
              </button>
              <button
                onClick={() => resolveActiveException("CONFIRMED")}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium"
                style={{
                  background: "transparent",
                  border: `1px solid ${COLORS.cardBorder}`,
                  color: COLORS.textPrimary,
                }}
              >
                <Check size={16} />
                确认穿越 (扣10分)
              </button>
            </>
          )}

          <button
            onClick={() => resolveActiveException("CANCELLED")}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium mt-1"
            style={{
              background: "rgba(255, 71, 87, 0.15)",
              color: COLORS.dangerRed,
            }}
          >
            <AlertTriangle size={16} />
            取消本次操作
          </button>
        </div>
      </div>
    </div>
  )
}
