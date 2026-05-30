import { useState, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useGameStore } from "@/store/gameStore"
import { getLevel } from "@/utils/levels"
import { COLORS } from "@/utils/colors"
import { synthesizeWave, X_RANGE_TOTAL } from "@/engine/wave"
import type { WaveCard, HistoryEntry } from "@/types"
import { Home, ChevronLeft, ChevronRight, Play, Pause, GitCompare } from "lucide-react"

function MiniWaveCanvas({ cards, width = 100, height = 40 }: { cards: WaveCard[]; width?: number; height?: number }) {
  const points = useMemo(() => synthesizeWave(cards, 0), [cards])
  if (points.length === 0) return null

  const mapX = (x: number) => (x / X_RANGE_TOTAL) * width
  const mapY = (y: number) => height / 2 - (y / 10) * (height / 2 - 4)

  const path = points.reduce((str, p, i) => {
    const x = mapX(p.x)
    const y = mapY(p.y)
    return str + (i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`)
  }, "")

  return (
    <svg width={width} height={height} className="shrink-0">
      <path d={path} fill="none" stroke={COLORS.waveTeal} strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  )
}

export default function ReplayPage() {
  const { levelId = "" } = useParams<{ levelId: string }>()
  const navigate = useNavigate()
  const history = useGameStore((s) => s.history)
  const targetWave = useGameStore((s) => s.targetWave)
  const startLevel = useGameStore((s) => s.startLevel)

  const [selectedIndex, setSelectedIndex] = useState(history.length - 1)
  const [isPlaying, setIsPlaying] = useState(false)

  const level = getLevel(levelId)

  const entry: HistoryEntry | null = history[selectedIndex] || null

  const cardsToShow = entry ? entry.afterSnapshot : []

  const goPrev = () => {
    if (selectedIndex > 0) setSelectedIndex(selectedIndex - 1)
  }

  const goNext = () => {
    if (selectedIndex < history.length - 1) setSelectedIndex(selectedIndex + 1)
  }

  const showDiff =
    entry &&
    entry.beforeSnapshot.length > 0 &&
    entry.afterSnapshot.length > 0 &&
    (entry.beforeSnapshot.length !== entry.afterSnapshot.length ||
      JSON.stringify(entry.beforeSnapshot) !== JSON.stringify(entry.afterSnapshot))

  return (
    <div className="min-h-screen flex flex-col" style={{ background: COLORS.bgDark }}>
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
              参数回放
            </h1>
            <p className="text-xs" style={{ color: COLORS.textMuted }}>
              {level?.name || "关卡"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/game/${levelId}`)}
            className="px-4 py-1.5 rounded-lg text-sm"
            style={{
              background: COLORS.waveTeal,
              color: "white",
            }}
          >
            返回游戏
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
        <div
          className="rounded-xl p-4"
          style={{
            background: COLORS.cardBg,
            border: `1px solid ${COLORS.cardBorder}`,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium" style={{ color: COLORS.textSecondary }}>
              操作历史 ({history.length} 条)
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={goPrev}
                disabled={selectedIndex <= 0}
                className="p-1.5 rounded-lg"
                style={{
                  color: selectedIndex <= 0 ? COLORS.textMuted : COLORS.textSecondary,
                  cursor: selectedIndex <= 0 ? "not-allowed" : "pointer",
                  opacity: selectedIndex <= 0 ? 0.4 : 1,
                }}
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-mono w-16 text-center" style={{ color: COLORS.textPrimary }}>
                {selectedIndex + 1} / {history.length}
              </span>
              <button
                onClick={goNext}
                disabled={selectedIndex >= history.length - 1}
                className="p-1.5 rounded-lg"
                style={{
                  color: selectedIndex >= history.length - 1 ? COLORS.textMuted : COLORS.textSecondary,
                  cursor: selectedIndex >= history.length - 1 ? "not-allowed" : "pointer",
                  opacity: selectedIndex >= history.length - 1 ? 0.4 : 1,
                }}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {history.map((h, i) => (
              <button
                key={h.id}
                onClick={() => setSelectedIndex(i)}
                className={`shrink-0 p-2 rounded-lg transition-all ${
                  i === selectedIndex ? "ring-2 ring-teal-400" : ""
                }`}
                style={{
                  background: i === selectedIndex ? "rgba(0, 212, 170, 0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${i === selectedIndex ? COLORS.waveTeal : COLORS.cardBorder}`,
                }}
              >
                <MiniWaveCanvas cards={h.afterSnapshot} width={100} height={50} />
                <div className="text-xs mt-1 text-center" style={{ color: COLORS.textMuted }}>
                  #{i + 1}
                </div>
                {h.requiresConfirmation && h.confirmedAt && (
                  <div
                    className="text-xs text-center mt-0.5"
                    style={{ color: COLORS.yellow }}
                  >
                    ✓ 已确认
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {entry && (
          <div className="flex-1 grid grid-cols-2 gap-4 overflow-hidden">
            <div
              className="rounded-xl p-4 flex flex-col"
              style={{
                background: COLORS.cardBg,
                border: `1px solid ${COLORS.cardBorder}`,
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>
                  {entry.action.replace(/_/g, " ")}
                </span>
                <span className="text-xs" style={{ color: COLORS.textMuted }}>
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="text-sm mb-4" style={{ color: COLORS.textSecondary }}>
                {entry.description}
              </p>

              <div className="flex-1 overflow-y-auto">
                <div className="text-xs font-semibold mb-2" style={{ color: COLORS.waveTeal }}>
                  变更后波形:
                </div>
                <div className="flex flex-col gap-2">
                  {entry.afterSnapshot.map((card, i) => (
                    <div
                      key={card.id}
                      className="flex items-center gap-2 p-2 rounded-lg"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        borderLeft: `3px solid ${card.color}`,
                      }}
                    >
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: card.color }}
                      />
                      <span className="text-xs" style={{ color: COLORS.textSecondary }}>
                        #{i + 1} A={card.amplitude.toFixed(1)} f={card.frequency.toFixed(1)} φ=
                        {card.phase.toFixed(2)}
                        {card.phaseUnit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div
              className="rounded-xl p-4 flex flex-col"
              style={{
                background: COLORS.cardBg,
                border: `1px solid ${COLORS.cardBorder}`,
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <GitCompare size={16} style={{ color: COLORS.waveTeal }} />
                <span className="text-sm font-semibold" style={{ color: COLORS.textPrimary }}>
                  差异对比
                </span>
              </div>

              {showDiff ? (
                <div className="flex-1 overflow-y-auto">
                  <div className="text-xs font-semibold mb-2" style={{ color: COLORS.dangerRed }}>
                    变更前:
                  </div>
                  <div className="flex flex-col gap-1 mb-4">
                    {entry.beforeSnapshot.map((card, i) => (
                      <div
                        key={card.id}
                        className="flex items-center gap-2 p-1.5 rounded opacity-60"
                        style={{
                          background: "rgba(255, 71, 87, 0.08)",
                        }}
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: card.color }}
                        />
                        <span className="text-xs" style={{ color: COLORS.textMuted }}>
                          #{i + 1} A={card.amplitude.toFixed(1)} f={card.frequency.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="text-xs font-semibold mb-2" style={{ color: COLORS.waveTeal }}>
                    变更后:
                  </div>
                  <div className="flex flex-col gap-1">
                    {entry.afterSnapshot.map((card, i) => (
                      <div
                        key={card.id}
                        className="flex items-center gap-2 p-1.5 rounded"
                        style={{
                          background: "rgba(0, 212, 170, 0.08)",
                        }}
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ background: card.color }}
                        />
                        <span className="text-xs" style={{ color: COLORS.textSecondary }}>
                          #{i + 1} A={card.amplitude.toFixed(1)} f={card.frequency.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center" style={{ color: COLORS.textMuted }}>
                  <span className="text-sm">无明显参数变化</span>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
