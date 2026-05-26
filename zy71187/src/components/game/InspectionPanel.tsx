import { useState, useRef, useCallback, DragEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, AlertTriangle, Clock, Pause, Play, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'
import type { Level, EquipmentItem, Accessory, Damage } from '@/types'
import { getEquipmentTypeLabel } from '@/data/levels'

interface InspectionPanelProps {
  level: Level
  matchedAccessories: Record<string, string>
  markedDamages: Record<string, string>
  depositCalculations: Record<string, number>
  selectedEquipmentId: string | null
  identifiedRedHerrings: string[]
  markedNormalWears: string[]
  timeRemaining: number
  phase: 'playing' | 'paused'
  onMatchAccessory: (accessoryId: string, equipmentId: string) => void
  onUnmatchAccessory: (accessoryId: string) => void
  onMarkDamage: (equipmentId: string, damageId: string) => void
  onUnmarkDamage: (equipmentId: string) => void
  onCalculateDeposit: (equipmentId: string, amount: number) => void
  onSelectEquipment: (id: string | null) => void
  onIdentifyRedHerring: (id: string) => void
  onMarkNormalWear: (id: string) => void
  onPause: () => void
  onResume: () => void
  onReset: () => void
  onSubmit: () => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function InspectionPanel(props: InspectionPanelProps) {
  const {
    level,
    matchedAccessories,
    markedDamages,
    depositCalculations,
    selectedEquipmentId,
    identifiedRedHerrings,
    markedNormalWears,
    timeRemaining,
    phase,
    onMatchAccessory,
    onUnmatchAccessory,
    onMarkDamage,
    onUnmarkDamage,
    onCalculateDeposit,
    onSelectEquipment,
    onIdentifyRedHerring,
    onMarkNormalWear,
    onPause,
    onResume,
    onReset,
    onSubmit,
  } = props

  const [expandedEq, setExpandedEq] = useState<string | null>(null)
  const [draggedAcc, setDraggedAcc] = useState<string | null>(null)
  const [dragOverEq, setDragOverEq] = useState<string | null>(null)
  const [depositInputs, setDepositInputs] = useState<Record<string, string>>({})

  const selectedEquipment = level.equipment.find((e) => e.id === selectedEquipmentId)

  const unmatchedAccessories = level.accessories.filter(
    (a) => !matchedAccessories[a.id],
  )

  const isAccDraggable = (acc: Accessory) => {
    return !matchedAccessories[acc.id]
  }

  const handleDragStart = useCallback((accId: string) => {
    setDraggedAcc(accId)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedAcc(null)
    setDragOverEq(null)
  }, [])

  const handleDragOver = useCallback((e: DragEvent, eqId: string) => {
    e.preventDefault()
    setDragOverEq(eqId)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverEq(null)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent, eqId: string) => {
      e.preventDefault()
      if (draggedAcc) {
        onMatchAccessory(draggedAcc, eqId)
      }
      setDraggedAcc(null)
      setDragOverEq(null)
    },
    [draggedAcc, onMatchAccessory],
  )

  const handleMarkMissing = useCallback(
    (accId: string) => {
      onMatchAccessory(accId, '__missing__')
    },
    [onMatchAccessory],
  )

  const toggleDamage = useCallback(
    (eqId: string, dmgId: string, isNormalWear: boolean) => {
      if (isNormalWear) {
        onMarkNormalWear(dmgId)
      } else {
        if (markedDamages[dmgId]) {
          onUnmarkDamage(eqId)
        } else {
          onMarkDamage(eqId, dmgId)
        }
      }
    },
    [markedDamages, onMarkDamage, onUnmarkDamage, onMarkNormalWear],
  )

  const handleDepositChange = useCallback(
    (eqId: string, value: string) => {
      setDepositInputs((prev) => ({ ...prev, [eqId]: value }))
      const num = parseFloat(value)
      if (!isNaN(num)) {
        onCalculateDeposit(eqId, num)
      }
    },
    [onCalculateDeposit],
  )

  const timePercent = (timeRemaining / level.timeLimit) * 100
  const timeColor =
    timePercent > 50 ? '#10b981' : timePercent > 25 ? '#f59e0b' : '#ef4444'

  return (
    <div className="fixed inset-0 flex flex-col pointer-events-none z-10">
      {/* Top HUD */}
      <div className="flex items-center justify-between p-4 pointer-events-auto">
        <div className="bg-black/80 backdrop-blur rounded-lg px-4 py-2 flex items-center gap-4">
          <span className="font-mono text-amber-400 text-lg font-bold">{level.name}</span>
          <div className="h-6 w-px bg-gray-600" />
          <div className="flex items-center gap-2">
            <Clock size={18} style={{ color: timeColor }} />
            <span className="font-mono text-xl" style={{ color: timeColor }}>
              {formatTime(timeRemaining)}
            </span>
          </div>
          <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ width: `${timePercent}%`, backgroundColor: timeColor }}
              animate={{ width: `${timePercent}%` }}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={phase === 'playing' ? onPause : onResume}
            className="bg-black/80 backdrop-blur hover:bg-black/90 p-2 rounded-lg transition-colors"
          >
            {phase === 'playing' ? (
              <Pause size={20} className="text-amber-400" />
            ) : (
              <Play size={20} className="text-green-400" />
            )}
          </button>
          <button
            onClick={onReset}
            className="bg-black/80 backdrop-blur hover:bg-black/90 p-2 rounded-lg transition-colors"
          >
            <RotateCcw size={20} className="text-gray-400" />
          </button>
          <button
            onClick={onSubmit}
            className="bg-amber-500 hover:bg-amber-400 text-black px-4 py-2 rounded-lg font-bold transition-colors"
          >
            提交
          </button>
        </div>
      </div>

      {/* Pause Overlay */}
      <AnimatePresence>
        {phase === 'paused' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/70 flex items-center justify-center pointer-events-auto z-20"
          >
            <div className="text-center">
              <Pause size={48} className="text-amber-400 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white mb-2">已暂停</h2>
              <p className="text-gray-400 mb-6">点击继续按钮恢复游戏</p>
              <button
                onClick={onResume}
                className="bg-amber-500 hover:bg-amber-400 text-black px-8 py-3 rounded-lg font-bold transition-colors flex items-center gap-2 mx-auto"
              >
                <Play size={20} /> 继续
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom - Accessory Pool */}
      <div className="mt-auto pointer-events-auto">
        <div className="bg-black/90 backdrop-blur p-4 border-t border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm text-gray-400 font-mono">待分配配件（拖拽到对应器材）:</span>
            <span className="text-xs text-amber-400">
              {unmatchedAccessories.length} 个未分配
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {level.accessories.map((acc) => {
              const isMatched = !!matchedAccessories[acc.id]
              const isMissing = matchedAccessories[acc.id] === '__missing__'
              return (
                <motion.div
                  key={acc.id}
                  layout
                  initial={{ scale: 1 }}
                  whileHover={{ scale: isMatched ? 1 : 1.05 }}
                  className={`px-3 py-2 rounded-lg font-mono text-sm cursor-grab active:cursor-grabbing transition-all ${
                    isMatched
                      ? isMissing
                        ? 'bg-red-900/50 text-red-400 line-through'
                        : 'bg-green-900/50 text-green-400'
                      : draggedAcc === acc.id
                        ? 'bg-amber-500 text-black scale-110'
                        : 'bg-gray-800 text-white hover:bg-gray-700'
                  }`}
                  draggable={isAccDraggable(acc)}
                  onDragStart={() => handleDragStart(acc.id)}
                  onDragEnd={handleDragEnd}
                >
                  <span className="mr-1">{acc.icon}</span>
                  {acc.name}
                  {isMatched && !isMissing && <Check size={14} className="inline ml-1" />}
                  {!isMatched && (
                    <button
                      onClick={() => handleMarkMissing(acc.id)}
                      className="ml-2 text-xs text-red-400 hover:text-red-300"
                      title="标记为缺失"
                    >
                      缺失?
                    </button>
                  )}
                  {isMatched && (
                    <button
                      onClick={() => onUnmatchAccessory(acc.id)}
                      className="ml-2 text-xs text-gray-400 hover:text-white"
                    >
                      <X size={12} className="inline" />
                    </button>
                  )}
                </motion.div>
              )
            })}
          </div>

          {/* Red Herrings */}
          {level.redHerrings.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-700">
              <span className="text-sm text-gray-400 font-mono">干扰物品（点击识别）:</span>
              <div className="flex gap-2 mt-2">
                {level.redHerrings.map((rh) => (
                  <button
                    key={rh.id}
                    onClick={() => onIdentifyRedHerring(rh.id)}
                    className={`px-3 py-2 rounded-lg font-mono text-sm transition-all ${
                      identifiedRedHerrings.includes(rh.id)
                        ? 'bg-green-900/50 text-green-400'
                        : 'bg-gray-800 text-white hover:bg-gray-700'
                    }`}
                  >
                    <span className="mr-1">{rh.icon}</span>
                    {rh.name}
                    {identifiedRedHerrings.includes(rh.id) && (
                      <Check size={14} className="inline ml-1" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Equipment List */}
      <div className="absolute right-0 top-20 bottom-48 w-96 overflow-y-auto pointer-events-auto bg-black/90 backdrop-blur border-l border-gray-700">
        <div className="p-4">
          <h3 className="font-mono text-amber-400 text-lg mb-4">器材清单</h3>
          <div className="space-y-3">
            {level.equipment.map((eq) => (
              <EquipmentCard
                key={eq.id}
                equipment={eq}
                level={level}
                isExpanded={expandedEq === eq.id}
                isSelected={selectedEquipmentId === eq.id}
                dragOver={dragOverEq === eq.id}
                matchedAccessories={matchedAccessories}
                markedDamages={markedDamages}
                markedNormalWears={markedNormalWears}
                depositInput={depositInputs[eq.id] || String(depositCalculations[eq.id] || '')}
                onToggleExpand={() =>
                  setExpandedEq(expandedEq === eq.id ? null : eq.id)
                }
                onSelect={() => onSelectEquipment(eq.id)}
                onDragOver={(e) => handleDragOver(e, eq.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, eq.id)}
                onUnmatchAccessory={onUnmatchAccessory}
                onMarkDamage={(dmgId, isNormal) =>
                  toggleDamage(eq.id, dmgId, isNormal)
                }
                onDepositChange={(val) => handleDepositChange(eq.id, val)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Selected Equipment Quick View */}
      {selectedEquipment && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="absolute left-4 bottom-56 bg-black/90 backdrop-blur rounded-lg p-4 pointer-events-auto border border-amber-500/50 w-72"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-2xl">{selectedEquipment.icon}</span>
            <button
              onClick={() => onSelectEquipment(null)}
              className="text-gray-400 hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
          <h4 className="font-bold text-white">{selectedEquipment.name}</h4>
          <p className="text-sm text-gray-400">
            {getEquipmentTypeLabel(selectedEquipment.type)}
          </p>
          <p className="text-xs text-amber-400 mt-2">
            基础押金: ¥{selectedEquipment.baseDeposit}
          </p>
          {selectedEquipment.batteryLevel !== undefined && (
            <p className="text-xs text-blue-400 mt-1">
              电量: {Math.round(selectedEquipment.batteryLevel * 100)}%
            </p>
          )}
        </motion.div>
      )}
    </div>
  )
}

interface EquipmentCardProps {
  equipment: EquipmentItem
  level: Level
  isExpanded: boolean
  isSelected: boolean
  dragOver: boolean
  matchedAccessories: Record<string, string>
  markedDamages: Record<string, string>
  markedNormalWears: string[]
  depositInput: string
  onToggleExpand: () => void
  onSelect: () => void
  onDragOver: (e: DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: DragEvent) => void
  onUnmatchAccessory: (id: string) => void
  onMarkDamage: (id: string, isNormal: boolean) => void
  onDepositChange: (val: string) => void
}

function EquipmentCard({
  equipment,
  level,
  isExpanded,
  isSelected,
  dragOver,
  matchedAccessories,
  markedDamages,
  markedNormalWears,
  depositInput,
  onToggleExpand,
  onSelect,
  onDragOver,
  onDragLeave,
  onDrop,
  onUnmatchAccessory,
  onMarkDamage,
  onDepositChange,
}: EquipmentCardProps) {
  const eqAccessories = level.accessories.filter(
    (a) => a.equipmentId === equipment.id,
  )
  const eqDamages = level.damages.filter((d) => d.equipmentId === equipment.id)

  const matchedCount = eqAccessories.filter(
    (a) => matchedAccessories[a.id] === equipment.id,
  ).length
  const missingCount = eqAccessories.filter((a) => a.isMissing).length
  const damageCount = eqDamages.filter((d) => !d.isNormalWear).length

  return (
    <motion.div
      layout
      className={`rounded-lg border transition-all ${
        isSelected
          ? 'border-amber-500 bg-amber-500/10'
          : dragOver
            ? 'border-amber-400 bg-amber-400/20'
            : 'border-gray-700 bg-gray-800/50'
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <button
        onClick={() => {
          onSelect()
          onToggleExpand()
        }}
        className="w-full p-3 flex items-center justify-between text-left hover:bg-white/5 rounded-lg"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{equipment.icon}</span>
          <div>
            <div className="font-mono text-sm text-white">{equipment.name}</div>
            <div className="text-xs text-gray-400">
              {getEquipmentTypeLabel(equipment.type)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-xs">
            {matchedCount > 0 && (
              <span className="text-green-400">
                {matchedCount}/{eqAccessories.length}
              </span>
            )}
            {missingCount > 0 && (
              <span className="text-red-400">缺{missingCount}</span>
            )}
            {damageCount > 0 && (
              <span className="text-amber-400">损{damageCount}</span>
            )}
          </div>
          {isExpanded ? (
            <ChevronUp size={16} className="text-gray-400" />
          ) : (
            <ChevronDown size={16} className="text-gray-400" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-3 pt-0 space-y-4 border-t border-gray-700/50 mt-2">
              {/* Accessories */}
              {eqAccessories.length > 0 && (
                <div>
                  <div className="text-xs text-gray-400 mb-2">配件:</div>
                  <div className="space-y-1">
                    {eqAccessories.map((acc) => {
                      const isMatched = matchedAccessories[acc.id] === equipment.id
                      const isMissing = matchedAccessories[acc.id] === '__missing__'
                      return (
                        <div
                          key={acc.id}
                          className={`flex items-center justify-between text-sm px-2 py-1 rounded ${
                            isMatched
                              ? 'bg-green-900/30 text-green-400'
                              : isMissing
                                ? 'bg-red-900/30 text-red-400 line-through'
                                : 'bg-gray-700/30 text-gray-300'
                          }`}
                        >
                          <span>
                            {acc.icon} {acc.name}
                          </span>
                          {isMatched && (
                            <button
                              onClick={() => onUnmatchAccessory(acc.id)}
                              className="text-gray-400 hover:text-white"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Damages */}
              {eqDamages.length > 0 && (
                <div>
                  <div className="text-xs text-gray-400 mb-2">检查损伤:</div>
                  <div className="space-y-2">
                    {eqDamages.map((dmg) => {
                      const isMarked = !!markedDamages[dmg.id]
                      const isNormalMarked = markedNormalWears.includes(dmg.id)
                      return (
                        <button
                          key={dmg.id}
                          onClick={() => onMarkDamage(dmg.id, dmg.isNormalWear)}
                          className={`w-full text-left px-2 py-2 rounded text-sm transition-colors ${
                            isMarked
                              ? 'bg-amber-900/50 text-amber-300 border border-amber-500'
                              : isNormalMarked
                                ? 'bg-gray-600/50 text-gray-400 border border-gray-500 line-through'
                                : 'bg-gray-700/50 text-gray-300 hover:bg-gray-600/50 border border-gray-600'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {dmg.isNormalWear ? (
                              <span className="text-gray-400">（正常痕迹）</span>
                            ) : (
                              <AlertTriangle
                                size={14}
                                className={
                                  dmg.severity === 'fatal'
                                    ? 'text-red-500'
                                    : dmg.severity === 'major'
                                      ? 'text-orange-500'
                                      : 'text-amber-500'
                                }
                              />
                            )}
                            <span>{dmg.description}</span>
                          </div>
                          <div className="text-xs mt-1 opacity-70">
                            {dmg.isNormalWear
                              ? '点击标记为正常使用痕迹'
                              : isMarked
                                ? '点击取消标记'
                                : '点击标记损伤'}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Deposit Calculator */}
              <div>
                <div className="text-xs text-gray-400 mb-2">押金计算:</div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-400">¥</span>
                  <input
                    type="number"
                    value={depositInput}
                    onChange={(e) => onDepositChange(e.target.value)}
                    className="flex-1 bg-gray-700 text-white px-2 py-1 rounded font-mono text-sm border border-gray-600 focus:border-amber-500 focus:outline-none"
                    placeholder="0"
                  />
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  基础: ¥{equipment.baseDeposit}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
