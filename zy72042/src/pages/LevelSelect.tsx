import { useNavigate } from 'react-router-dom'
import { Coffee, Clock, Target, Shield, Coins } from 'lucide-react'
import { LEVELS, LEVEL_TYPE_LABELS, LEVEL_TYPE_COLORS } from '@/data/levels'
import { useLevelStore } from '@/stores/levelStore'

export default function LevelSelect() {
  const navigate = useNavigate()
  const completedLevels = useLevelStore((s) => s.completedLevels)

  return (
    <div className="pt-20 bg-cafe-cream min-h-screen">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-10 relative">
          <div className="absolute -top-4 left-1/4 w-3 h-3 rounded-full bg-cafe-latte/60" />
          <div className="absolute -top-2 left-1/3 w-2 h-2 rounded-full bg-cafe-brown/20" />
          <div className="absolute -top-4 right-1/4 w-3 h-3 rounded-full bg-cafe-latte/60" />
          <div className="absolute -top-2 right-1/3 w-2 h-2 rounded-full bg-cafe-brown/20" />
          <h1 className="font-serif text-4xl text-cafe-brown mb-3">基金组合咖啡馆</h1>
          <p className="text-cafe-brown/60 text-lg">在咖啡馆里学习基金组合的奥秘</p>
          <Coffee className="w-8 h-8 mx-auto mt-4 text-cafe-brown/40" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {LEVELS.map((level) => {
            const isCompleted = completedLevels.includes(level.id)
            return (
              <div
                key={level.id}
                className="card-cafe cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/cafe/${level.id}`)}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: LEVEL_TYPE_COLORS[level.type] }}
                  >
                    {LEVEL_TYPE_LABELS[level.type]}
                  </span>
                  {isCompleted && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-safe-green/20 text-safe-green">
                      已通关
                    </span>
                  )}
                </div>

                <h2 className="font-serif text-xl text-cafe-brown mb-2">{level.name}</h2>
                <p className="text-sm text-cafe-brown/60 mb-4">{level.description}</p>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="flex items-center gap-1.5 text-xs text-cafe-brown/70">
                    <Target className="w-3.5 h-3.5" />
                    <span>目标分数: {level.targetScore}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-cafe-brown/70">
                    <Shield className="w-3.5 h-3.5" />
                    <span>风险红线: {(level.riskLimit * 100).toFixed(0)}%</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-cafe-brown/70">
                    <Clock className="w-3.5 h-3.5" />
                    <span>时间限制: {level.timeLimit}秒</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-cafe-brown/70">
                    <Coins className="w-3.5 h-3.5" />
                    <span>初始资源: {level.initialResources}</span>
                  </div>
                </div>

                <button className="btn-primary w-full text-sm py-2">
                  开始挑战
                </button>
              </div>
            )
          })}
        </div>

        <div className="text-center mt-8 text-sm text-cafe-brown/50">
          已完成 {completedLevels.length} / {LEVELS.length} 关卡
        </div>
      </div>
    </div>
  )
}
