import { motion } from 'framer-motion'
import { Camera, HelpCircle, History, Trophy, Clock, AlertTriangle } from 'lucide-react'
import { levels } from '@/data/levels'
import type { GameHistory } from '@/types'

interface MainMenuProps {
  onSelectLevel: (id: string) => void
  gameHistory: GameHistory[]
  onShowInstructions: () => void
}

const difficultyColors: Record<string, string> = {
  beginner: 'from-green-600 to-green-800',
  intermediate: 'from-amber-600 to-amber-800',
  expert: 'from-red-600 to-red-800',
}

const difficultyLabels: Record<string, string> = {
  beginner: '入门',
  intermediate: '进阶',
  expert: '挑战',
}

export default function MainMenu({
  onSelectLevel,
  gameHistory,
  onShowInstructions,
}: MainMenuProps) {
  const bestScores: Record<string, GameHistory | undefined> = {}
  for (const h of gameHistory) {
    if (!bestScores[h.levelId] || h.score > bestScores[h.levelId]!.score) {
      bestScores[h.levelId] = h
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1419] via-[#1a2332] to-[#0f1419] text-white">
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="flex items-center justify-center gap-4 mb-4">
            <Camera size={48} className="text-amber-400" />
            <h1 className="text-5xl font-bold bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent">
              影棚器材归还模拟器
            </h1>
          </div>
          <p className="text-gray-400 text-lg">
            训练你的归还检查技能——配件不漏查、损伤不遗漏、押金不出错
          </p>
        </motion.div>

        {/* Level Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {levels.map((level, index) => {
            const best = bestScores[level.id]
            return (
              <motion.div
                key={level.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.02, y: -4 }}
                onClick={() => onSelectLevel(level.id)}
                className={`rounded-xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-amber-500/50 transition-all bg-gray-800/50 backdrop-blur`}
              >
                <div
                  className={`h-32 bg-gradient-to-br ${difficultyColors[level.difficulty]} flex items-center justify-center relative`}
                >
                  <span className="text-6xl">{level.icon}</span>
                  <div className="absolute top-2 right-2 px-2 py-1 bg-black/30 rounded text-xs font-mono">
                    {difficultyLabels[level.difficulty]}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-lg mb-2">{level.name}</h3>
                  <p className="text-sm text-gray-400 mb-4 line-clamp-2">
                    {level.description}
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1 text-gray-400">
                      <Clock size={14} />
                      <span>{level.timeLimit}秒</span>
                    </div>
                    {best && (
                      <div className="flex items-center gap-1 text-amber-400">
                        <Trophy size={14} />
                        <span>{best.score}分</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 text-xs text-gray-500">
                    器材: {level.equipment.length}件 | 配件: {level.accessories.length}件 | 损伤: {level.damages.length}处
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Instructions */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-800/50 backdrop-blur rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <HelpCircle size={24} className="text-amber-400" />
              <h3 className="text-xl font-bold">游戏说明</h3>
            </div>
            <ul className="space-y-3 text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-amber-400">1.</span>
                <span>将底部的配件拖拽到右侧对应器材上</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400">2.</span>
                <span>点击器材卡片展开，检查并标记损伤</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400">3.</span>
                <span>计算每件器材的押金金额</span>
              </li>
              <li className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-red-400 mt-0.5" />
                <span>注意：有些配件可能已缺失，有些物品是干扰项！</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400">4.</span>
                <span>点击"提交"或时间结束时自动判定</span>
              </li>
            </ul>
            <button
              onClick={onShowInstructions}
              className="mt-4 text-amber-400 hover:text-amber-300 text-sm"
            >
              查看详细规则 →
            </button>
          </motion.div>

          {/* History */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-gray-800/50 backdrop-blur rounded-xl p-6"
          >
            <div className="flex items-center gap-3 mb-4">
              <History size={24} className="text-amber-400" />
              <h3 className="text-xl font-bold">历史记录</h3>
            </div>
            {gameHistory.length === 0 ? (
              <p className="text-gray-500 text-center py-8">暂无记录</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {gameHistory.slice(0, 5).map((h, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm p-2 rounded bg-gray-700/30"
                  >
                    <span className="text-gray-300 truncate">{h.levelName}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={h.passed ? 'text-green-400' : 'text-red-400'}
                      >
                        {h.score}分
                      </span>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${h.passed ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'}`}
                      >
                        {h.passed ? '通过' : '未过'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
