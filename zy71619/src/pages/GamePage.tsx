import { useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useGameStore } from "@/store/gameStore"
import WaveCanvas from "@/components/WaveCanvas"
import WaveCardEditor from "@/components/WaveCardEditor"
import ScorePanel from "@/components/ScorePanel"
import ExceptionPanel from "@/components/ExceptionPanel"
import { getLevel } from "@/utils/levels"
import { COLORS } from "@/utils/colors"
import { Home, RotateCcw, Play, Pause, History, FileText } from "lucide-react"

export default function GamePage() {
  const { levelId = "" } = useParams<{ levelId: string }>()
  const navigate = useNavigate()

  const { startLevel, isRunning, setIsRunning, resetLevel, activeException, checkExceptions } =
    useGameStore()

  const level = getLevel(levelId)

  useEffect(() => {
    if (levelId && level) {
      startLevel(levelId)
    }
    return () => {}
  }, [levelId, level, startLevel])

  useEffect(() => {
    if (isRunning && !activeException) {
      checkExceptions()
    }
  }, [isRunning, activeException, checkExceptions])

  if (!level) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: COLORS.bgDark }}>
        <div className="text-center">
          <p className="text-xl mb-4" style={{ color: COLORS.textPrimary }}>关卡不存在</p>
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 rounded-lg"
            style={{ background: COLORS.waveTeal, color: "white" }}
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

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
              {level.name}
            </h1>
            <p className="text-xs" style={{ color: COLORS.textMuted }}>
              {level.description}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/replay/${levelId}`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
            style={{
              background: "transparent",
              border: `1px solid ${COLORS.cardBorder}`,
              color: COLORS.textSecondary,
            }}
          >
            <History size={16} />
            回放
          </button>
          <button
            onClick={() => navigate("/report")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
            style={{
              background: "transparent",
              border: `1px solid ${COLORS.cardBorder}`,
              color: COLORS.textSecondary,
            }}
          >
            <FileText size={16} />
            报告
          </button>
          <button
            onClick={() => setIsRunning(!isRunning)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
            style={{
              background: isRunning ? "transparent" : COLORS.waveTeal,
              border: isRunning ? `1px solid ${COLORS.cardBorder}` : "none",
              color: isRunning ? COLORS.textSecondary : "white",
            }}
          >
            {isRunning ? <Pause size={16} /> : <Play size={16} />}
            {isRunning ? "暂停" : "开始"}
          </button>
          <button
            onClick={resetLevel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
            style={{
              background: "transparent",
              border: `1px solid ${COLORS.cardBorder}`,
              color: COLORS.textSecondary,
            }}
          >
            <RotateCcw size={16} />
            重置
          </button>
        </div>
      </header>

      <main className="flex-1 flex p-4 gap-4 overflow-hidden">
        <div
          className="w-80 flex-shrink-0 rounded-xl overflow-hidden"
          style={{
            background: COLORS.cardBg,
            border: `1px solid ${COLORS.cardBorder}`,
          }}
        >
          <div
            className="px-4 py-3 text-sm font-semibold"
            style={{
              color: COLORS.textPrimary,
              borderBottom: `1px solid ${COLORS.cardBorder}`,
            }}
          >
            波形参数
          </div>
          <div className="h-[calc(100vh-180px)]">
            <WaveCardEditor />
          </div>
        </div>

        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="flex-1 min-h-0">
            <WaveCanvas />
          </div>
        </div>

        <div className="w-72 flex-shrink-0">
          <ScorePanel />
        </div>
      </main>

      <ExceptionPanel />
    </div>
  )
}
