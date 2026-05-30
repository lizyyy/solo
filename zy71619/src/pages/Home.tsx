import { useNavigate } from "react-router-dom"
import { LEVELS } from "@/utils/levels"
import { COLORS } from "@/utils/colors"
import { Play, Waves, Trophy, BookOpen } from "lucide-react"

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: COLORS.bgDark }}>
      <header
        className="flex items-center justify-between px-8 py-4"
        style={{
          background: COLORS.cardBg,
          borderBottom: `1px solid ${COLORS.cardBorder}`,
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${COLORS.waveTeal}, ${COLORS.purple})` }}
          >
            <Waves size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold" style={{ color: COLORS.textPrimary }}>
              傅里叶海浪冲浪
            </h1>
            <p className="text-xs" style={{ color: COLORS.textMuted }}>
              在海浪中学习正弦波叠加
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/report")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm"
            style={{
              background: "transparent",
              border: `1px solid ${COLORS.cardBorder}`,
              color: COLORS.textSecondary,
            }}
          >
            <BookOpen size={16} />
            课堂报告
          </button>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
        <section className="text-center mb-12 pt-8">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm mb-4"
            style={{
              background: "rgba(0, 212, 170, 0.1)",
              color: COLORS.waveTeal,
              border: `1px solid rgba(0, 212, 170, 0.2)`,
            }}
          >
            <Trophy size={14} />
            数学课堂互动教学工具
          </div>
          <h2
            className="text-4xl font-bold mb-4"
            style={{
              color: COLORS.textPrimary,
            }}
          >
            调参造浪，<span style={{ color: COLORS.waveTeal }}>傅里叶冲浪</span>
          </h2>
          <p className="text-base max-w-xl mx-auto" style={{ color: COLORS.textSecondary }}>
            调整振幅、频率、相位，合成独特的海浪波形。
            让冲浪板随波逐流，在游戏中掌握正弦波叠加的奥秘。
          </p>
        </section>

        <section className="mb-10">
          <h3 className="text-sm font-semibold mb-4" style={{ color: COLORS.textSecondary }}>
            选择关卡
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {LEVELS.map((level, i) => (
              <button
                key={level.id}
                onClick={() => navigate(`/game/${level.id}`)}
                className="text-left p-5 rounded-xl transition-all hover:scale-[1.02]"
                style={{
                  background: COLORS.cardBg,
                  border: `1px solid ${COLORS.cardBorder}`,
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{
                          background: `linear-gradient(135deg, ${COLORS.waveTeal}, ${COLORS.purple})`,
                          color: "white",
                        }}
                      >
                        {i + 1}
                      </span>
                      <span className="text-base font-semibold" style={{ color: COLORS.textPrimary }}>
                        {level.name}
                      </span>
                    </div>
                    <p className="text-sm mb-3" style={{ color: COLORS.textSecondary }}>
                      {level.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs" style={{ color: COLORS.textMuted }}>
                      <span>目标波: {level.targetWave.length} 路</span>
                      <span>满分: {level.maxScore}</span>
                      <span>达标: {level.matchThreshold}%</span>
                    </div>
                  </div>
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `${COLORS.waveTeal}20`, color: COLORS.waveTeal }}
                  >
                    <Play size={18} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section>
          <div
            className="rounded-xl p-6"
            style={{
              background: COLORS.cardBg,
              border: `1px solid ${COLORS.cardBorder}`,
            }}
          >
            <h3 className="text-sm font-semibold mb-4" style={{ color: COLORS.textSecondary }}>
              操作说明
            </h3>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
                  style={{ background: `${COLORS.waveTeal}20`, color: COLORS.waveTeal }}
                >
                  🎛️
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                  调参造浪
                </p>
                <p className="text-xs" style={{ color: COLORS.textMuted }}>
                  在左侧面板添加波形卡，调整振幅、频率、相位合成海浪
                </p>
              </div>
              <div>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
                  style={{ background: `${COLORS.sunsetOrange}20`, color: COLORS.sunsetOrange }}
                >
                  🏄
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                  观察冲浪
                </p>
                <p className="text-xs" style={{ color: COLORS.textMuted }}>
                  冲浪板沿波形运动，虚线为目标波形，努力让两条波重合
                </p>
              </div>
              <div>
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center mb-2"
                  style={{ background: `${COLORS.purple}20`, color: COLORS.purple }}
                >
                  📊
                </div>
                <p className="text-sm font-medium mb-1" style={{ color: COLORS.textPrimary }}>
                  评分反馈
                </p>
                <p className="text-xs" style={{ color: COLORS.textMuted }}>
                  右侧面板实时显示分数、扣分明细、改进建议和报告
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
