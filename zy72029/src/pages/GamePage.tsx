import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { Dashboard } from '@/components/Dashboard'
import { MaterialCard } from '@/components/MaterialCard'
import { SlotDropZone } from '@/components/SlotDropZone'
import { OperationHistory } from '@/components/OperationHistory'
import { FloatingMessages } from '@/components/FloatingMessages'
import { SupplementNoteModal } from '@/components/SupplementNoteModal'
import { Play, Pause, RotateCcw, Settings, FileText, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function GamePage() {
  const navigate = useNavigate()
  const {
    status,
    materials,
    slots,
    placedMaterials,
    studentName,
    setStudentName,
    startGame,
    pauseGame,
    resumeGame,
    tick,
    resetGame,
    getGameResult,
    materialPack,
    failureReason,
    diagnosticDetails,
    score,
    risk,
    resource,
  } = useGameStore()

  const [showStartModal, setShowStartModal] = useState(true)
  const [showSupplementModal, setShowSupplementModal] = useState(false)
  const [selectedOperationId, setSelectedOperationId] = useState<string | undefined>(undefined)
  const [usePresetScenarios, setUsePresetScenarios] = useState(true)

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    if (status === 'playing') {
      interval = setInterval(() => tick(), 1000)
    }
    return () => clearInterval(interval)
  }, [status, tick])

  useEffect(() => {
    if (status === 'completed' || status === 'failed') {
      const result = getGameResult()
      const timer = setTimeout(() => {
        navigate('/result', { state: { result } })
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [status, navigate, getGameResult])

  const getUnplacedMaterials = () => {
    return materials.filter(m => !placedMaterials[m.id])
  }

  const getPlacedMaterialsForSlot = (slotId: string) => {
    const materialIds = Object.keys(placedMaterials).filter(id => placedMaterials[id] === slotId)
    return materials.filter(m => materialIds.includes(m.id))
  }

  const handleAddSupplement = (operationId: string) => {
    setSelectedOperationId(operationId)
    setShowSupplementModal(true)
  }

  const getFailureReasonText = () => {
    switch (failureReason) {
      case 'rule_misunderstanding':
        return '规则理解错误'
      case 'timeout':
        return '操作超时'
      default:
        return ''
    }
  }

  const getFailureDescription = () => {
    if (!diagnosticDetails || diagnosticDetails.length === 0) return ''
    return diagnosticDetails[diagnosticDetails.length - 1]
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Dashboard />

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <div>
              <h1 className="font-mono text-xl font-bold text-paper-cream">
                保险理赔逃脱屋
              </h1>
              <p className="text-xs text-white/50 mt-0.5">
                {materialPack.name}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {status === 'playing' && (
                <button
                  onClick={() => pauseGame('教师手动暂停', false)}
                  className="flex items-center gap-2 px-4 py-2 bg-warning-orange/20 text-warning-orange border border-warning-orange/30 font-mono text-sm hover:bg-warning-orange/30 transition-colors"
                >
                  <Pause size={16} />
                  暂停
                </button>
              )}
              {status === 'paused' && (
                <button
                  onClick={resumeGame}
                  className="flex items-center gap-2 px-4 py-2 bg-success-green/20 text-success-green border border-success-green/30 font-mono text-sm hover:bg-success-green/30 transition-colors"
                >
                  <Play size={16} />
                  继续
                </button>
              )}
              <button
                onClick={() => navigate('/config')}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 text-paper-cream border border-white/20 font-mono text-sm hover:bg-white/10 transition-colors"
              >
                <Settings size={16} />
                配置
              </button>
              <button
                onClick={resetGame}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 text-paper-cream border border-white/20 font-mono text-sm hover:bg-white/10 transition-colors"
              >
                <RotateCcw size={16} />
                重置
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            <div className="mb-6">
              <h2 className="font-mono text-sm text-white/50 mb-3 flex items-center gap-2">
                <FileText size={14} />
                待匹配材料
              </h2>
              <div className="flex flex-wrap gap-3">
                {getUnplacedMaterials().length === 0 ? (
                  <div className="text-white/30 text-sm py-8">
                    所有材料已放置完成
                  </div>
                ) : (
                  getUnplacedMaterials().map(material => (
                    <MaterialCard
                      key={material.id}
                      material={material}
                      isPlaced={false}
                    />
                  ))
                )}
              </div>
            </div>

            <div>
              <h2 className="font-mono text-sm text-white/50 mb-3">
                匹配槽位（拖拽材料到对应位置）
              </h2>
              <div className="flex gap-3">
                {slots.map(slot => (
                  <SlotDropZone
                    key={slot.id}
                    slot={slot}
                    placedMaterials={getPlacedMaterialsForSlot(slot.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="w-80 flex-shrink-0">
          <OperationHistory onAddSupplement={handleAddSupplement} />
        </div>
      </div>

      <FloatingMessages />

      <AnimatePresence>
        {showStartModal && status === 'idle' && (
          <motion.div
            key="start-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-40"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-paper-cream text-charcoal p-8 max-w-md w-full mx-4 border-2 border-calm-blue"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-mono text-2xl font-bold">保险理赔逃脱屋</h2>
                <button
                  onClick={() => setShowStartModal(false)}
                  className="p-1 hover:bg-black/10 rounded-sm"
                >
                  <X size={20} />
                </button>
              </div>

              <p className="text-sm opacity-70 mb-6">
                欢迎使用保险理赔逃脱屋练习工具。请将左侧材料拖拽到右侧对应槽位中。
                每次操作都会影响分数、资源和风险值。风险值过高或时间耗尽都会导致失败。
              </p>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium mb-1">学生姓名</label>
                  <input
                    type="text"
                    value={studentName}
                    onChange={e => setStudentName(e.target.value)}
                    placeholder="请输入学生姓名"
                    className="w-full px-3 py-2 border-2 border-charcoal/20 bg-white text-charcoal font-mono text-sm focus:outline-none focus:border-calm-blue"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="usePreset"
                    checked={usePresetScenarios}
                    onChange={e => setUsePresetScenarios(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="usePreset" className="text-sm">
                    启用课堂场景（包含预设误操作、边界分数、暂停记录）
                  </label>
                </div>

                {usePresetScenarios && (
                  <div className="bg-warning-orange/10 border border-warning-orange/30 p-3 text-xs">
                    <p className="font-medium text-warning-orange mb-1">课堂场景说明</p>
                    <ul className="space-y-1 text-charcoal/70">
                      <li>- 预设2条新手误操作记录</li>
                      <li>- 预设1条教师故意打断的暂停记录</li>
                      <li>- 启用边界分数提示（50分及格线）</li>
                    </ul>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  startGame(usePresetScenarios)
                  setShowStartModal(false)
                }}
                className="w-full py-3 bg-charcoal text-paper-cream font-mono text-lg hover:bg-charcoal/90 transition-colors flex items-center justify-center gap-2"
              >
                <Play size={20} />
                开始练习
              </button>

              <p className="text-xs text-center text-charcoal/50 mt-4">
                材料来源：{materialPack.source}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {status === 'paused' && (
          <motion.div
            key="pause-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-40"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="text-center"
            >
              <div className="text-6xl mb-4">⏸</div>
              <h2 className="font-mono text-4xl font-bold text-paper-cream mb-2">
                练习已暂停
              </h2>
              <p className="text-white/60 mb-8">
                点击"继续"按钮恢复练习
              </p>
              <button
                onClick={resumeGame}
                className="px-8 py-3 bg-success-green text-charcoal font-mono text-lg hover:bg-success-green/90 transition-colors flex items-center justify-center gap-2 mx-auto"
              >
                <Play size={20} />
                继续练习
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(status === 'completed' || status === 'failed') && (
          <motion.div
            key="result-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-40"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: -20 }}
              className="bg-paper-cream text-charcoal p-8 max-w-lg w-full mx-4 border-2 border-charcoal"
            >
              <div className="text-center mb-6">
                {status === 'completed' ? (
                  <>
                    <div className="text-6xl mb-4">🎉</div>
                    <h2 className="font-mono text-3xl font-bold text-success-green mb-2">
                      恭喜！逃脱成功！
                    </h2>
                    <p className="text-charcoal/60">所有材料已正确匹配</p>
                  </>
                ) : (
                  <>
                    <div className="text-6xl mb-4">💥</div>
                    <h2 className="font-mono text-3xl font-bold text-danger-red mb-2">
                      逃脱失败
                    </h2>
                    <div className="bg-warning-orange/10 border border-warning-orange/30 p-4 mb-4">
                      <p className="font-mono font-bold text-warning-orange mb-1">
                        失败原因：{getFailureReasonText()}
                      </p>
                      <p className="text-sm text-charcoal/70">
                        {getFailureDescription()}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-charcoal/5">
                  <div className="font-mono text-2xl font-bold text-success-green">{score}</div>
                  <div className="text-xs text-charcoal/60">最终分数</div>
                </div>
                <div className="text-center p-4 bg-charcoal/5">
                  <div className="font-mono text-2xl font-bold text-danger-red">{risk}</div>
                  <div className="text-xs text-charcoal/60">风险值</div>
                </div>
                <div className="text-center p-4 bg-charcoal/5">
                  <div className="font-mono text-2xl font-bold text-calm-blue">{resource}</div>
                  <div className="text-xs text-charcoal/60">剩余资源</div>
                </div>
              </div>

              <p className="text-center text-sm text-charcoal/60 mb-4">
                正在跳转到结果分析页面...
              </p>

              <div className="flex justify-center">
                <div className="w-8 h-8 border-2 border-charcoal/20 border-t-charcoal rounded-full animate-spin" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showSupplementModal && (
        <SupplementNoteModal
          operationId={selectedOperationId}
          onClose={() => {
            setShowSupplementModal(false)
            setSelectedOperationId(undefined)
          }}
        />
      )}
    </div>
  )
}
