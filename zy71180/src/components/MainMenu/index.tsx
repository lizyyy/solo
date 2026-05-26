import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Star,
  Trophy,
  Play,
  History,
  Trash2,
  Calendar,
  Target,
  AlertOctagon,
  RotateCcw,
  Map,
  CheckCircle2,
  XCircle
} from 'lucide-react'
import type { Level, GameHistory } from '@/types/game'

interface MainMenuProps {
  levels: Level[]
  history: GameHistory[]
  onStartGame: (level: Level) => void
  onStartReplay: (historyId: string) => void
  onClearHistory: () => void
}

type TabType = 'levels' | 'history'

export default function MainMenu({
  levels,
  history,
  onStartGame,
  onStartReplay,
  onClearHistory
}: MainMenuProps) {
  const [activeTab, setActiveTab] = useState<TabType>('levels')

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          className="text-center mb-10"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="p-3 bg-amber-500 rounded-2xl shadow-lg">
              <Map className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-amber-900 mb-2">
            餐厨油脂回收游戏
          </h1>
          <p className="text-amber-700 text-lg">
            规划路线，高效回收，成为最佳回收员！
          </p>
        </motion.div>

        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-2xl p-1.5 shadow-md flex gap-1">
            <TabButton
              active={activeTab === 'levels'}
              onClick={() => setActiveTab('levels')}
              icon={<Target className="w-4 h-4" />}
              label="关卡选择"
            />
            <TabButton
              active={activeTab === 'history'}
              onClick={() => setActiveTab('history')}
              icon={<History className="w-4 h-4" />}
              label="历史记录"
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'levels' ? (
            <motion.div
              key="levels"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {levels.map((level, index) => (
                <LevelCard
                  key={level.id}
                  level={level}
                  index={index}
                  onStart={() => onStartGame(level)}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {history.length > 0 && (
                <div className="flex justify-end mb-4">
                  <motion.button
                    className="flex items-center gap-2 text-red-600 hover:text-red-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-red-50 transition-colors"
                    onClick={onClearHistory}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Trash2 className="w-4 h-4" />
                    清空记录
                  </motion.button>
                </div>
              )}

              <div className="space-y-3">
                {history.length === 0 ? (
                  <EmptyHistory />
                ) : (
                  history.map((record, index) => (
                    <HistoryItem
                      key={record.id}
                      record={record}
                      index={index}
                      onReplay={() => onStartReplay(record.id)}
                    />
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  icon,
  label
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <motion.button
      className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all ${
        active
          ? 'bg-amber-500 text-white shadow-md'
          : 'text-amber-700 hover:bg-amber-100'
      }`}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {icon}
      {label}
    </motion.button>
  )
}

function LevelCard({
  level,
  index,
  onStart
}: {
  level: Level
  index: number
  onStart: () => void
}) {
  return (
    <motion.div
      className="bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-amber-100 hover:border-amber-300 transition-colors"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold text-gray-800">{level.name}</h3>
              {level.isBoundaryCase && (
                <motion.div
                  className="flex items-center gap-1 bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.1 + 0.2, type: 'spring' }}
                >
                  <AlertOctagon className="w-3 h-3" />
                  边界案例
                </motion.div>
              )}
            </div>
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-4 h-4 ${
                    i < level.difficulty
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        <p className="text-gray-600 text-sm mb-4 leading-relaxed">
          {level.description}
        </p>

        {level.isBoundaryCase && level.boundaryDescription && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <p className="text-red-700 text-xs">
              <span className="font-bold">边界提示：</span>
              {level.boundaryDescription}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-amber-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-amber-700 text-xs mb-1">
              <Trophy className="w-3.5 h-3.5" />
              目标分数
            </div>
            <p className="text-lg font-bold text-amber-900">
              {level.targetScore}
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-1.5 text-blue-700 text-xs mb-1">
              <Target className="w-3.5 h-3.5" />
              回合限制
            </div>
            <p className="text-lg font-bold text-blue-900">
              {level.maxTurns} 回合
            </p>
          </div>
        </div>

        <motion.button
          className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 shadow-md"
          onClick={onStart}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Play className="w-5 h-5" />
          开始游戏
        </motion.button>
      </div>
    </motion.div>
  )
}

function HistoryItem({
  record,
  index,
  onReplay
}: {
  record: GameHistory
  index: number
  onReplay: () => void
}) {
  const date = new Date(record.timestamp)
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`

  return (
    <motion.div
      className="bg-white rounded-xl shadow-md p-4 flex items-center gap-4 border border-gray-100"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ x: 4, transition: { duration: 0.2 } }}
    >
      <div
        className={`p-3 rounded-xl ${
          record.isWin ? 'bg-green-100' : 'bg-red-100'
        }`}
      >
        {record.isWin ? (
          <CheckCircle2 className="w-6 h-6 text-green-600" />
        ) : (
          <XCircle className="w-6 h-6 text-red-600" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-gray-800 truncate">
            {record.levelName}
          </span>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              record.isWin
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {record.isWin ? '胜利' : '失败'}
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {dateStr}
          </span>
          <span className="flex items-center gap-1">
            <Trophy className="w-3.5 h-3.5" />
            {record.finalScore} 分
          </span>
          <span className="flex items-center gap-1">
            <Target className="w-3.5 h-3.5" />
            {record.totalTurns}/{record.maxTurns} 回合
          </span>
        </div>
        {record.failureReason && !record.isWin && (
          <p className="text-xs text-red-500 mt-1">
            失败原因：{record.failureReason}
          </p>
        )}
      </div>

      <motion.button
        className="flex items-center gap-1.5 text-amber-600 hover:text-amber-700 font-medium px-4 py-2 rounded-lg hover:bg-amber-50 transition-colors whitespace-nowrap"
        onClick={onReplay}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <RotateCcw className="w-4 h-4" />
        回放
      </motion.button>
    </motion.div>
  )
}

function EmptyHistory() {
  return (
    <motion.div
      className="bg-white rounded-2xl shadow-md p-12 text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <History className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-700 mb-2">
        暂无游戏记录
      </h3>
      <p className="text-gray-500">
        完成游戏后，记录将显示在这里
      </p>
    </motion.div>
  )
}
