import { motion } from 'framer-motion'
import { X, Check, AlertTriangle, Trophy, Download, RotateCcw, Home } from 'lucide-react'
import type { ScoreResult, Level, PlayerAction } from '@/types'
import { generateReplayEvents } from '@/utils/replay'
import { exportCSVReport, downloadCSV } from '@/utils/reportExport'

interface ResultPageProps {
  level: Level
  scoreResult: ScoreResult
  actions: PlayerAction[]
  matchedAccessories: Record<string, string>
  markedDamages: Record<string, string>
  depositCalculations: Record<string, number>
  onRetry: () => void
  onGoHome: () => void
}

export default function ResultPage({
  level,
  scoreResult,
  actions,
  matchedAccessories,
  markedDamages,
  depositCalculations,
  onRetry,
  onGoHome,
}: ResultPageProps) {
  const { score, breakdown, failures, passed, needsTraining } = scoreResult

  const replayEvents = generateReplayEvents(
    actions,
    scoreResult.correctAccessoryMatches,
    scoreResult.correctDamages,
  )

  const handleExport = () => {
    const csv = exportCSVReport(
      level.name,
      level.equipment.map((e) => ({ name: e.name, type: e.type })),
      matchedAccessories,
      level.accessories.map((a) => ({
        id: a.id,
        name: a.name,
        equipmentId: a.equipmentId,
        isMissing: a.isMissing,
      })),
      markedDamages,
      level.damages.map((d) => ({
        id: d.id,
        description: d.description,
        equipmentId: d.equipmentId,
        severity: d.severity,
        isNormalWear: d.isNormalWear,
      })),
      depositCalculations,
      scoreResult.correctDepositAmounts,
      score,
      passed,
    )
    downloadCSV(`器材归还报告_${level.name}_${Date.now()}.csv`, csv)
  }

  const getGrade = () => {
    if (score >= 90) return { label: '优秀', color: 'text-green-400', bg: 'bg-green-900/30' }
    if (score >= 80) return { label: '通过', color: 'text-green-400', bg: 'bg-green-900/30' }
    if (score >= 60) return { label: '需培训', color: 'text-amber-400', bg: 'bg-amber-900/30' }
    return { label: '未通过', color: 'text-red-400', bg: 'bg-red-900/30' }
  }

  const grade = getGrade()

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f1419] via-[#1a2332] to-[#0f1419] text-white">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold mb-2">{level.name}</h1>
          <p className="text-gray-400">检查报告</p>
        </motion.div>

        {/* Score Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`rounded-2xl p-8 mb-8 ${grade.bg} border border-current ${grade.color}`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-400 mb-1">总分</div>
              <div className="text-6xl font-bold">{score}</div>
              <div className={`mt-2 text-xl font-bold ${grade.color}`}>
                {passed ? <Check className="inline mr-2" size={24} /> : <AlertTriangle className="inline mr-2" size={24} />}
                {grade.label}
              </div>
              {needsTraining && (
                <p className="text-amber-400 text-sm mt-2">建议参加进一步培训</p>
              )}
            </div>
            <Trophy size={120} className={grade.color} />
          </div>
        </motion.div>

        {/* Score Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-800/50 backdrop-blur rounded-xl p-6 mb-8"
        >
          <h3 className="text-lg font-bold mb-4">得分明细</h3>
          <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
            <ScoreItem label="配件匹配" value={breakdown.accessoryScore} />
            <ScoreItem label="损伤标记" value={breakdown.damageScore} />
            <ScoreItem label="押金计算" value={breakdown.depositScore} />
            <ScoreItem label="正常磨损" value={breakdown.normalWearScore} />
            <ScoreItem label="干扰识别" value={breakdown.redHerringScore} />
            <ScoreItem label="时间奖励" value={breakdown.timeBonus} />
            <ScoreItem label="速度奖励" value={breakdown.speedBonus} highlight />
          </div>
        </motion.div>

        {/* Failures */}
        {failures.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 mb-8"
          >
            <h3 className="text-lg font-bold text-red-400 mb-4 flex items-center gap-2">
              <AlertTriangle size={20} />
              错误项 ({failures.length})
            </h3>
            <ul className="space-y-2">
              {failures.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-red-300">
                  <span className="text-red-500">•</span>
                  {f}
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Deposit Comparison */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-800/50 backdrop-blur rounded-xl p-6 mb-8"
        >
          <h3 className="text-lg font-bold mb-4">押金核对</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 border-b border-gray-700">
                  <th className="text-left py-2">器材</th>
                  <th className="text-right py-2">玩家计算</th>
                  <th className="text-right py-2">正确金额</th>
                  <th className="text-right py-2">偏差</th>
                </tr>
              </thead>
              <tbody>
                {level.equipment.map((eq) => {
                  const player = depositCalculations[eq.id] || 0
                  const correct = scoreResult.correctDepositAmounts[eq.id] || 0
                  const diff = player - correct
                  const isCorrect = Math.abs(diff) <= 5
                  return (
                    <tr key={eq.id} className="border-b border-gray-700/50">
                      <td className="py-2">
                        {eq.icon} {eq.name}
                      </td>
                      <td className={`text-right py-2 font-mono ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                        ¥{player}
                      </td>
                      <td className="text-right py-2 font-mono text-gray-400">¥{correct}</td>
                      <td className={`text-right py-2 font-mono ${isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                        {diff > 0 ? '+' : ''}
                        {diff}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Replay Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gray-800/50 backdrop-blur rounded-xl p-6 mb-8"
        >
          <h3 className="text-lg font-bold mb-4">操作回放</h3>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-700" />
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {replayEvents.map((event, i) => (
                <div key={i} className="flex items-start gap-3 pl-2">
                  <div
                    className={`w-3 h-3 rounded-full mt-1.5 ${event.isCorrect ? 'bg-green-500' : 'bg-red-500'}`}
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 font-mono">
                        {formatTime(event.timestamp)}
                      </span>
                      <span className={event.isCorrect ? 'text-green-400' : 'text-red-400'}>
                        {event.isCorrect ? <Check size={12} /> : <X size={12} />}
                      </span>
                    </div>
                    <div className="text-sm text-gray-300">{event.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-wrap gap-4 justify-center"
        >
          <button
            onClick={onRetry}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black px-6 py-3 rounded-lg font-bold transition-colors"
          >
            <RotateCcw size={20} />
            再玩一次
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-bold transition-colors"
          >
            <Download size={20} />
            导出报告
          </button>
          <button
            onClick={onGoHome}
            className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg font-bold transition-colors border border-gray-600"
          >
            <Home size={20} />
            返回主菜单
          </button>
        </motion.div>
      </div>
    </div>
  )
}

function ScoreItem({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  const isPositive = value >= 0
  return (
    <div className={`text-center p-4 rounded-lg ${highlight ? 'bg-amber-900/20 border border-amber-500/30' : 'bg-gray-700/30'}`}>
      <div className="text-xs text-gray-400 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
        {isPositive ? '+' : ''}
        {value}
      </div>
    </div>
  )
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}
