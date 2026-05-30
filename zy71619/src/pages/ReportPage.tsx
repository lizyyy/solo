import { useNavigate } from "react-router-dom"
import { useGameStore } from "@/store/gameStore"
import { COLORS } from "@/utils/colors"
import { getLevel, LEVELS } from "@/utils/levels"
import { getExceptionLabel } from "@/engine/exceptions"
import type { ClassReport, Deduction } from "@/types"
import { Home, Download, Printer, FileJson, Lightbulb, AlertTriangle, Trophy } from "lucide-react"

function generateClassReport(): ClassReport {
  const score = useGameStore.getState().score
  const levelId = useGameStore.getState().levelId
  const exceptions = useGameStore.getState().exceptions

  const level = getLevel(levelId)

  return {
    classCode: "MATH-2026-001",
    generatedAt: Date.now(),
    students: [
      {
        name: "学生 1",
        levels: [
          {
            levelId,
            levelName: level?.name || levelId,
            score: score.total,
            maxScore: score.maxScore,
            deductions: score.deductions,
            exceptions,
            suggestions: score.suggestions,
            keyChoices: score.keyChoices,
          },
        ],
      },
    ],
  }
}

function exportReportJSON() {
  const report = generateClassReport()
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `fourier-report-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function printReport() {
  window.print()
}

function DeductionItem({ deduction }: { deduction: Deduction }) {
  return (
    <div
      className="flex items-start justify-between p-3 rounded-lg mb-1.5"
      style={{
        background: "rgba(255, 71, 87, 0.06)",
        borderLeft: `3px solid ${COLORS.dangerRed}`,
      }}
    >
      <div className="flex-1">
        <p className="text-sm" style={{ color: COLORS.textPrimary }}>
          {deduction.reason}
        </p>
        <p className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>
          {new Date(deduction.timestamp).toLocaleString()}
        </p>
      </div>
      <span
        className="ml-3 font-mono text-sm font-semibold shrink-0"
        style={{ color: COLORS.dangerRed }}
      >
        -{deduction.points}
      </span>
    </div>
  )
}

export default function ReportPage() {
  const navigate = useNavigate()
  const score = useGameStore((s) => s.score)
  const levelId = useGameStore((s) => s.levelId)
  const exceptions = useGameStore((s) => s.exceptions)

  const level = getLevel(levelId)
  const percent = score.maxScore > 0 ? Math.round((score.total / score.maxScore) * 100) : 0

  return (
    <div className="min-h-screen" style={{ background: COLORS.bgDark }}>
      <header
        className="flex items-center justify-between px-6 py-3"
        style={{
          background: COLORS.cardBg,
          borderBottom: `1px solid ${COLORS.cardBorder}`,
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-lg hover:opacity-80"
            style={{ color: COLORS.textSecondary }}
          >
            <Home size={20} />
          </button>
          <div>
            <h1 className="text-lg font-bold" style={{ color: COLORS.textPrimary }}>
              课堂报告
            </h1>
            <p className="text-xs" style={{ color: COLORS.textMuted }}>
              {level?.name || "傅里叶海浪冲浪"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportReportJSON}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
            style={{
              background: "transparent",
              border: `1px solid ${COLORS.cardBorder}`,
              color: COLORS.textSecondary,
            }}
          >
            <FileJson size={16} />
            导出 JSON
          </button>
          <button
            onClick={printReport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
            style={{
              background: COLORS.waveTeal,
              color: "white",
            }}
          >
            <Printer size={16} />
            打印报告
          </button>
        </div>
      </header>

      <main className="p-6 max-w-4xl mx-auto">
        <div
          className="rounded-xl p-6 mb-6"
          style={{
            background: COLORS.cardBg,
            border: `1px solid ${COLORS.cardBorder}`,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold mb-1" style={{ color: COLORS.textPrimary }}>
                {level?.name}
              </h2>
              <p className="text-sm" style={{ color: COLORS.textMuted }}>
                {level?.description}
              </p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 mb-1">
                <Trophy size={20} style={{ color: COLORS.yellow }} />
                <span className="text-3xl font-bold" style={{ color: COLORS.waveTeal }}>
                  {score.total}
                </span>
                <span className="text-lg" style={{ color: COLORS.textMuted }}>
                  / {score.maxScore}
                </span>
              </div>
              <span className="text-sm" style={{ color: COLORS.textMuted }}>
                得分率 {percent}% · 匹配度 {Math.round(score.matchPercent)}%
              </span>
            </div>
          </div>

          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${score.matchPercent}%`,
                background: `linear-gradient(to right, ${COLORS.waveTeal}, ${COLORS.purple})`,
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div
            className="rounded-xl p-5"
            style={{
              background: COLORS.cardBg,
              border: `1px solid ${COLORS.cardBorder}`,
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle size={18} style={{ color: COLORS.dangerRed }} />
              <h3 className="text-base font-semibold" style={{ color: COLORS.textPrimary }}>
                扣分明细
              </h3>
            </div>

            {score.deductions.length > 0 ? (
              <div>
                {score.deductions.map((d) => (
                  <DeductionItem key={d.id} deduction={d} />
                ))}
              </div>
            ) : (
              <div
                className="text-center py-8 rounded-lg"
                style={{ background: "rgba(0, 212, 170, 0.06)", color: COLORS.waveTeal }}
              >
                <p className="text-sm font-medium">🎉 没有任何扣分</p>
              </div>
            )}
          </div>

          <div
            className="rounded-xl p-5"
            style={{
              background: COLORS.cardBg,
              border: `1px solid ${COLORS.cardBorder}`,
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb size={18} style={{ color: COLORS.yellow }} />
              <h3 className="text-base font-semibold" style={{ color: COLORS.textPrimary }}>
                改进建议
              </h3>
            </div>

            {score.suggestions.length > 0 ? (
              <div className="flex flex-col gap-2">
                {score.suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg"
                    style={{
                      background: "rgba(253, 203, 110, 0.06)",
                      borderLeft: `3px solid ${COLORS.yellow}`,
                    }}
                  >
                    <p className="text-sm" style={{ color: COLORS.textPrimary }}>
                      {s}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="text-center py-8 rounded-lg"
                style={{ background: "rgba(0, 212, 170, 0.06)", color: COLORS.waveTeal }}
              >
                <p className="text-sm font-medium">✨ 表现完美！没有建议</p>
              </div>
            )}
          </div>
        </div>

        {exceptions.length > 0 && (
          <div
            className="rounded-xl p-5 mt-6"
            style={{
              background: COLORS.cardBg,
              border: `1px solid ${COLORS.cardBorder}`,
            }}
          >
            <h3 className="text-base font-semibold mb-4" style={{ color: COLORS.textPrimary }}>
              异常记录 ({exceptions.length})
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {exceptions.map((e) => (
                <div
                  key={e.id}
                  className="p-3 rounded-lg"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${COLORS.cardBorder}`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{
                        background: e.resolution === "CONFIRMED"
                          ? "rgba(255, 71, 87, 0.15)"
                          : "rgba(0, 212, 170, 0.15)",
                        color: e.resolution === "CONFIRMED" ? COLORS.dangerRed : COLORS.waveTeal,
                      }}
                    >
                      {getExceptionLabel(e.type)}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: COLORS.textMuted }}>
                    {e.resolution === "AUTO_FIXED" && "已自动修正"}
                    {e.resolution === "MANUAL_FIXED" && "已手动修正"}
                    {e.resolution === "CONFIRMED" && "已确认 (扣分)"}
                    {e.resolution === "CANCELLED" && "已取消"}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-center mt-8" style={{ color: COLORS.textMuted }}>
          <p className="text-xs">
            报告生成时间: {new Date().toLocaleString()} · 傅里叶海浪冲浪教学系统
          </p>
        </div>
      </main>
    </div>
  )
}
