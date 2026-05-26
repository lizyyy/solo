import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Trophy,
  XCircle,
  Home,
  RotateCcw,
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  MapPin,
  Droplets,
  Star,
  Zap,
  Package,
  Timer,
  AlertTriangle,
  FileText,
  TrendingUp
} from 'lucide-react'
import type {
  ScoreBreakdown,
  GameHistory,
  TurnAction,
  RouteNode
} from '@/types/game'

interface SettlementProps {
  isWin: boolean
  failureReason?: string
  levelName: string
  finalScore: number
  totalTurns: number
  maxTurns: number
  scoreBreakdown: ScoreBreakdown
  history: GameHistory
  onBack: () => void
  onRestart: () => void
  onExport: () => void
  onCopyReport: () => void
  turns: TurnAction[]
  copied?: boolean
}

interface AnimatedNumberProps {
  value: number
  duration?: number
  prefix?: string
  suffix?: string
  className?: string
}

function AnimatedNumber({
  value,
  duration = 1,
  prefix = '',
  suffix = '',
  className = ''
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    let startTime: number
    let animationFrame: number

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1)
      const easeProgress = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(Math.round(value * easeProgress))

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate)
      }
    }

    animationFrame = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(animationFrame)
  }, [value, duration])

  return (
    <span className={className}>
      {prefix}
      {displayValue.toLocaleString()}
      {suffix}
    </span>
  )
}

function ScoreRow({
  label,
  value,
  icon: Icon,
  color
}: {
  label: string
  value: number
  icon: React.ElementType
  color: 'green' | 'red' | 'amber'
}) {
  const colorClasses = {
    green: 'text-emerald-400 bg-emerald-500/20',
    red: 'text-red-400 bg-red-500/20',
    amber: 'text-amber-400 bg-amber-500/20'
  }

  const valueColor = value > 0 ? 'text-emerald-400' : value < 0 ? 'text-red-400' : 'text-slate-400'
  const sign = value > 0 ? '+' : ''

  return (
    <motion.tr
      className="border-b border-slate-700 last:border-0"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-slate-200 font-medium">{label}</span>
        </div>
      </td>
      <td className="py-3 px-4 text-right">
        <motion.span
          className={`font-bold text-lg ${valueColor}`}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5, type: 'spring' }}
        >
          {sign}
          <AnimatedNumber value={Math.abs(value)} duration={0.8} />
        </motion.span>
      </td>
    </motion.tr>
  )
}

function TurnDetail({ turn, index }: { turn: TurnAction; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false)

  const getRouteSummary = (route: RouteNode[]) => {
    return route.map(node => node.id).join(' → ')
  }

  const getTotalCollected = (collectedOil: Record<string, number>) => {
    return Object.values(collectedOil).reduce((sum, val) => sum + val, 0)
  }

  const totalCollected = getTotalCollected(turn.collectedOil)

  return (
    <motion.div
      className="border border-slate-700 rounded-xl overflow-hidden bg-slate-800"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <button
        className="w-full p-4 flex items-center justify-between hover:bg-slate-700/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-500/20 rounded-full flex items-center justify-center">
            <span className="text-amber-400 font-bold">{turn.turn}</span>
          </div>
          <div className="text-left">
            <p className="font-semibold text-slate-100">第 {turn.turn} 回合</p>
            <p className="text-sm text-slate-400">
              收集 {totalCollected}L · 得分 {turn.scoreThisTurn}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {turn.event && (
            <span
              className={`text-xs px-2 py-1 rounded-full font-medium ${
                turn.event.type === 'positive'
                  ? 'bg-green-500/20 text-green-400'
                  : turn.event.type === 'negative'
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-blue-500/20 text-blue-400'
              }`}
            >
              {turn.event.title}
            </span>
          )}
          {turn.complaints > 0 && (
            <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400 font-medium">
              投诉 ×{turn.complaints}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-slate-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 border-t border-slate-700 bg-slate-900/50">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                    <MapPin className="w-4 h-4" />
                    <span className="font-medium">行驶路线</span>
                  </div>
                  <p className="text-slate-200 font-mono text-sm">
                    {getRouteSummary(turn.route)}
                  </p>
                  <p className="text-slate-500 text-sm mt-1">
                    总距离：{turn.totalDistance.toFixed(1)} 单位
                  </p>
                </div>

                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                    <Droplets className="w-4 h-4" />
                    <span className="font-medium">收集详情</span>
                  </div>
                  <div className="space-y-1">
                    {Object.entries(turn.collectedOil).map(([id, amount]) => (
                      <div key={id} className="flex justify-between text-sm">
                        <span className="text-slate-400">{id}</span>
                        <span className="font-medium text-amber-400">+{amount}L</span>
                      </div>
                    ))}
                    {Object.keys(turn.collectedOil).length === 0 && (
                      <span className="text-slate-500 text-sm">无收集</span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                    <Star className="w-4 h-4" />
                    <span className="font-medium">本回合得分</span>
                  </div>
                  <p
                    className={`text-2xl font-bold ${
                      turn.scoreThisTurn >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {turn.scoreThisTurn >= 0 ? '+' : ''}
                    {turn.scoreThisTurn}
                  </p>
                </div>

                {turn.event && (
                  <div className="bg-slate-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                      <Zap className="w-4 h-4" />
                      <span className="font-medium">随机事件</span>
                    </div>
                    <div
                      className={`p-3 rounded-lg ${
                        turn.event.type === 'positive'
                          ? 'bg-green-500/10 border border-green-500/30'
                          : turn.event.type === 'negative'
                          ? 'bg-red-500/10 border border-red-500/30'
                          : 'bg-blue-500/10 border border-blue-500/30'
                      }`}
                    >
                      <p
                        className={`font-semibold ${
                          turn.event.type === 'positive'
                            ? 'text-green-400'
                            : turn.event.type === 'negative'
                            ? 'text-red-400'
                            : 'text-blue-400'
                        }`}
                      >
                        {turn.event.title}
                      </p>
                      <p
                        className={`text-sm ${
                          turn.event.type === 'positive'
                            ? 'text-green-300'
                            : turn.event.type === 'negative'
                            ? 'text-red-300'
                            : 'text-blue-300'
                        }`}
                      >
                        {turn.event.description}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 bg-slate-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                  <FileText className="w-4 h-4" />
                  <span className="font-medium">餐厅状态</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {turn.restaurantStates.map(rs => (
                    <div
                      key={rs.id}
                      className={`p-2 rounded-lg text-sm ${
                        rs.isOverflowing
                          ? 'bg-red-500/10 border border-red-500/30'
                          : 'bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`font-medium ${
                            rs.isOverflowing ? 'text-red-400' : 'text-slate-300'
                          }`}
                        >
                          {rs.id}
                        </span>
                        {rs.isOverflowing && (
                          <AlertTriangle className="w-3 h-3 text-red-500" />
                        )}
                      </div>
                      <div
                        className={`text-xs ${
                          rs.isOverflowing ? 'text-red-300' : 'text-slate-500'
                        }`}
                      >
                        {rs.currentOil}L
                        {rs.isOverflowing && ' · 溢出'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function Settlement({
  isWin,
  failureReason,
  levelName,
  finalScore,
  totalTurns,
  maxTurns,
  scoreBreakdown,
  onBack,
  onRestart,
  onExport,
  onCopyReport,
  turns,
  copied = false,
}: SettlementProps) {
  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          className="text-center mb-8"
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <motion.div
            className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-4 ${
              isWin
                ? 'bg-gradient-to-br from-emerald-400 to-green-600'
                : 'bg-gradient-to-br from-red-400 to-rose-600'
            } shadow-lg`}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, type: 'spring', bounce: 0.5 }}
          >
            {isWin ? (
              <Trophy className="w-12 h-12 text-white" />
            ) : (
              <XCircle className="w-12 h-12 text-white" />
            )}
          </motion.div>

          <motion.h1
            className={`text-5xl font-bold mb-3 ${
              isWin ? 'text-emerald-400' : 'text-red-400'
            }`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            {isWin ? '胜利！' : '失败'}
          </motion.h1>

          {!isWin && failureReason && (
            <motion.div
              className="inline-block bg-red-500/20 border-2 border-red-500/50 text-red-300 px-6 py-3 rounded-xl font-bold text-lg shadow-md"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: 'spring' }}
            >
              <AlertTriangle className="w-5 h-5 inline-block mr-2" />
              {failureReason}
            </motion.div>
          )}
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="card p-6 text-center">
            <div className="flex items-center justify-center gap-2 text-slate-400 text-sm mb-2">
              <MapPin className="w-4 h-4" />
              关卡名称
            </div>
            <p className="text-xl font-bold text-slate-100">{levelName}</p>
          </div>

          <div className="card p-6 text-center">
            <div className="flex items-center justify-center gap-2 text-slate-400 text-sm mb-2">
              <Star className="w-4 h-4" />
              最终得分
            </div>
            <p
              className={`text-3xl font-bold ${
                finalScore >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              <AnimatedNumber value={finalScore} duration={1.2} />
            </p>
          </div>

          <div className="card p-6 text-center">
            <div className="flex items-center justify-center gap-2 text-slate-400 text-sm mb-2">
              <Timer className="w-4 h-4" />
              使用回合
            </div>
            <p className="text-3xl font-bold text-amber-400">
              <AnimatedNumber value={totalTurns} duration={1} />
              <span className="text-slate-500 text-xl">/{maxTurns}</span>
            </p>
          </div>
        </motion.div>

        <motion.div
          className="card overflow-hidden mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="bg-gradient-to-r from-amber-600 to-orange-600 px-6 py-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              得分明细
            </h2>
          </div>
          <div className="p-2">
            <table className="w-full">
              <tbody>
                <ScoreRow
                  label="基础分"
                  value={scoreBreakdown.baseScore}
                  icon={Star}
                  color="amber"
                />
                <ScoreRow
                  label="效率奖励"
                  value={scoreBreakdown.efficiencyBonus}
                  icon={Zap}
                  color="green"
                />
                <ScoreRow
                  label="容量奖励"
                  value={scoreBreakdown.capacityBonus}
                  icon={Package}
                  color="green"
                />
                <ScoreRow
                  label="回合奖励"
                  value={scoreBreakdown.turnBonus}
                  icon={Timer}
                  color="green"
                />
                <ScoreRow
                  label="溢出惩罚"
                  value={-scoreBreakdown.overflowPenalty}
                  icon={AlertTriangle}
                  color="red"
                />
                <ScoreRow
                  label="投诉惩罚"
                  value={-scoreBreakdown.complaintPenalty}
                  icon={XCircle}
                  color="red"
                />
              </tbody>
            </table>
          </div>
          <div className="bg-slate-900/50 px-6 py-4 border-t border-slate-700">
            <div className="flex items-center justify-between">
              <span className="text-slate-200 font-bold text-lg">总计</span>
              <span
                className={`text-3xl font-bold ${
                  scoreBreakdown.total >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {scoreBreakdown.total >= 0 ? '+' : ''}
                <AnimatedNumber value={scoreBreakdown.total} duration={1.5} />
              </span>
            </div>
          </div>
        </motion.div>

        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            回合详情
            <span className="text-sm font-normal text-slate-400">
              （点击展开查看）
            </span>
          </h2>
          <div className="space-y-3">
            {turns.map((turn, index) => (
              <TurnDetail key={turn.turn} turn={turn} index={index} />
            ))}
          </div>
        </motion.div>

        <motion.div
          className="flex flex-wrap justify-center gap-4 mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <motion.button
            className="btn-secondary"
            onClick={onBack}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Home className="w-5 h-5" />
            返回菜单
          </motion.button>

          <motion.button
            className="btn-primary"
            onClick={onRestart}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <RotateCcw className="w-5 h-5" />
            重新开始
          </motion.button>

          <motion.button
            className="btn-success"
            onClick={onExport}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Download className="w-5 h-5" />
            导出JSON报告
          </motion.button>

          <motion.button
            className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-all ${
              copied
                ? 'bg-success-500 text-white'
                : 'bg-primary-500 hover:bg-primary-600 text-white'
            }`}
            onClick={onCopyReport}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {copied ? (
              <>
                <Check className="w-5 h-5" />
                已复制
              </>
            ) : (
              <>
                <Copy className="w-5 h-5" />
                复制报告
              </>
            )}
          </motion.button>
        </motion.div>

        <motion.div
          className="text-center text-slate-500 text-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          餐厨油脂回收游戏 · 结算报告
        </motion.div>
      </div>
    </div>
  )
}
