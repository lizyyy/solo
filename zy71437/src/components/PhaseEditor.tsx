import React, { useMemo } from 'react'
import type { Scenario, PhaseConfig, Movement } from '../../shared/types.js'
import { Plus, Trash2, ChevronUp, ChevronDown, AlertTriangle, Plus as PlusIcon, Minus as MinusIcon } from 'lucide-react'

interface Props {
  scenario: Scenario
  phaseConfig: PhaseConfig[]
  onChange: (phases: PhaseConfig[]) => void
  currentPhaseIndex: number
  onPhaseSelect: (index: number) => void
}

const DIRECTION_LABEL: Record<string, string> = {
  north: '北',
  south: '南',
  east: '东',
  west: '西',
}

const LANE_TYPE_LABEL: Record<string, string> = {
  straight: '直行',
  left: '左转',
  right: '右转',
  bus: '公交',
}

const OPPOSING: Record<string, string> = {
  north: 'south',
  south: 'north',
  east: 'west',
  west: 'east',
}

function getPerpendicular(direction: string): string[] {
  if (direction === 'north' || direction === 'south') return ['east', 'west']
  return ['north', 'south']
}

function getEffectiveType(laneType: string): string {
  return laneType === 'bus' ? 'straight' : laneType
}

function movementsConflict(
  dir1: string,
  type1: string,
  dir2: string,
  type2: string,
): boolean {
  const et1 = getEffectiveType(type1)
  const et2 = getEffectiveType(type2)

  if (et1 === 'right' || et2 === 'right') return false
  if (dir1 === dir2) return false

  const opp1 = OPPOSING[dir1]
  const perp1 = getPerpendicular(dir1)

  if (et1 === 'straight') {
    if (et2 === 'straight') return perp1.includes(dir2)
    if (et2 === 'left') return dir2 === opp1 || perp1.includes(dir2)
  }

  if (et1 === 'left') {
    if (et2 === 'straight') return dir2 === opp1 || perp1.includes(dir2)
    if (et2 === 'left') return perp1.includes(dir2)
  }

  return false
}

export default function PhaseEditor({
  scenario,
  phaseConfig,
  onChange,
  currentPhaseIndex,
  onPhaseSelect,
}: Props) {
  const currentPhase = phaseConfig[currentPhaseIndex]

  const phaseConflicts = useMemo(() => {
    const approachMap = new Map(scenario.approaches.map((a) => [a.id, a]))
    return phaseConfig.map((phase) => {
      const conflicts: [string, string, string, string][] = []
      const movements = phase.movements

      for (let i = 0; i < movements.length; i++) {
        for (let j = i + 1; j < movements.length; j++) {
          const m1 = movements[i]
          const m2 = movements[j]
          const a1 = approachMap.get(m1.approachId)
          const a2 = approachMap.get(m2.approachId)
          if (!a1 || !a2) continue

          if (movementsConflict(a1.direction, m1.laneType, a2.direction, m2.laneType)) {
            conflicts.push([a1.direction, m1.laneType, a2.direction, m2.laneType])
          }
        }
      }
      return conflicts
    })
  }, [phaseConfig, scenario.approaches])

  const hasConflict = phaseConflicts[currentPhaseIndex]?.length > 0

  const updatePhase = (updates: Partial<PhaseConfig>) => {
    const newPhases = [...phaseConfig]
    newPhases[currentPhaseIndex] = { ...currentPhase, ...updates }
    onChange(newPhases)
  }

  const addPhase = () => {
    const newPhase: PhaseConfig = {
      id: `phase-${Date.now()}`,
      name: `相位 ${phaseConfig.length + 1}`,
      greenSeconds: 30,
      yellowSeconds: 3,
      redClearanceSeconds: 2,
      movements: [],
    }
    onChange([...phaseConfig, newPhase])
    onPhaseSelect(phaseConfig.length)
  }

  const deletePhase = () => {
    if (phaseConfig.length <= 2) return
    const newPhases = phaseConfig.filter((_, i) => i !== currentPhaseIndex)
    onChange(newPhases)
    onPhaseSelect(Math.max(0, currentPhaseIndex - 1))
  }

  const movePhase = (direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? currentPhaseIndex - 1 : currentPhaseIndex + 1
    if (newIndex < 0 || newIndex >= phaseConfig.length) return
    const newPhases = [...phaseConfig]
    ;[newPhases[currentPhaseIndex], newPhases[newIndex]] = [newPhases[newIndex], newPhases[currentPhaseIndex]]
    onChange(newPhases)
    onPhaseSelect(newIndex)
  }

  const updateTime = (field: 'greenSeconds' | 'yellowSeconds' | 'redClearanceSeconds', delta: number) => {
    const min = field === 'greenSeconds' ? 5 : field === 'yellowSeconds' ? 2 : 1
    const max = field === 'greenSeconds' ? 120 : field === 'yellowSeconds' ? 5 : 3
    const newValue = Math.max(min, Math.min(max, currentPhase[field] + delta))
    updatePhase({ [field]: newValue })
  }

  const toggleMovement = (approachId: string, laneType: string) => {
    const existingIndex = currentPhase.movements.findIndex(
      (m) => m.approachId === approachId && m.laneType === laneType
    )
    let newMovements: Movement[]
    if (existingIndex >= 0) {
      newMovements = currentPhase.movements.filter((_, i) => i !== existingIndex)
    } else {
      newMovements = [...currentPhase.movements, { approachId, laneType: laneType as Movement['laneType'] }]
    }
    updatePhase({ movements: newMovements })
  }

  const togglePedestrian = (crossingId: string) => {
    const existingIndex = currentPhase.movements.findIndex(
      (m) => m.pedestrianCrossingId === crossingId
    )
    const approach = scenario.approaches.find(a => 
      scenario.pedestrianCrossings.find(c => c.id === crossingId)?.approachId === a.id
    )
    let newMovements: Movement[]
    if (existingIndex >= 0) {
      newMovements = currentPhase.movements.filter((_, i) => i !== existingIndex)
    } else if (approach) {
      newMovements = [...currentPhase.movements, { approachId: approach.id, laneType: 'straight', pedestrianCrossingId: crossingId }]
    } else {
      return
    }
    updatePhase({ movements: newMovements })
  }

  const isMovementChecked = (approachId: string, laneType: string) => {
    return currentPhase.movements.some(
      (m) => m.approachId === approachId && m.laneType === laneType && !m.pedestrianCrossingId
    )
  }

  const isPedestrianChecked = (crossingId: string) => {
    return currentPhase.movements.some((m) => m.pedestrianCrossingId === crossingId)
  }

  const isMovementConflicting = (approachId: string, laneType: string) => {
    const approach = scenario.approaches.find((a) => a.id === approachId)
    if (!approach) return false
    const conflicts = phaseConflicts[currentPhaseIndex] || []
    return conflicts.some(
      ([d1, t1, d2, t2]) =>
        (d1 === approach.direction && t1 === laneType) ||
        (d2 === approach.direction && t2 === laneType)
    )
  }

  const getUniqueLaneTypes = (approach: typeof scenario.approaches[0]) => {
    const types = new Set<string>()
    approach.lanes.forEach((lane) => {
      if (lane.type !== 'bus' || !types.has('straight')) {
        types.add(lane.type)
      }
    })
    return Array.from(types)
  }

  return (
    <div className="flex gap-4 h-full">
      <div className="w-80 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">相位时间轴</h3>
          <button
            onClick={addPhase}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加相位
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {phaseConfig.map((phase, index) => {
            const totalTime = phase.greenSeconds + phase.yellowSeconds + phase.redClearanceSeconds
            const greenWidth = (phase.greenSeconds / totalTime) * 100
            const yellowWidth = (phase.yellowSeconds / totalTime) * 100
            const redWidth = (phase.redClearanceSeconds / totalTime) * 100
            const isSelected = index === currentPhaseIndex
            const hasPhaseConflict = phaseConflicts[index]?.length > 0

            return (
              <div
                key={phase.id}
                onClick={() => onPhaseSelect(index)}
                className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                  hasPhaseConflict
                    ? 'border-red-500 bg-red-500/10'
                    : isSelected
                    ? 'border-emerald-500 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.4)]'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-100">{phase.name}</span>
                  <span className="text-xs text-slate-400">{totalTime}s</span>
                </div>
                <div className="flex h-3 rounded overflow-hidden">
                  <div
                    className="bg-[#22C55E]"
                    style={{ width: `${greenWidth}%` }}
                    title={`绿灯: ${phase.greenSeconds}s`}
                  />
                  <div
                    className="bg-[#EAB308]"
                    style={{ width: `${yellowWidth}%` }}
                    title={`黄灯: ${phase.yellowSeconds}s`}
                  />
                  <div
                    className="bg-[#EF4444]"
                    style={{ width: `${redWidth}%` }}
                    title={`红灯清空: ${phase.redClearanceSeconds}s`}
                  />
                </div>
                {hasPhaseConflict && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-red-400">
                    <AlertTriangle className="w-3 h-3" />
                    存在方向冲突
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700">
        {currentPhase && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-slate-100">编辑相位</h3>
                {hasConflict && (
                  <div className="flex items-center gap-1 px-2 py-1 bg-red-500/20 rounded-lg text-red-400 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    ⚠️ 该相位存在方向冲突
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => movePhase('up')}
                  disabled={currentPhaseIndex === 0}
                  className="p-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <ChevronUp className="w-4 h-4 text-slate-200" />
                </button>
                <button
                  onClick={() => movePhase('down')}
                  disabled={currentPhaseIndex === phaseConfig.length - 1}
                  className="p-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  <ChevronDown className="w-4 h-4 text-slate-200" />
                </button>
                <button
                  onClick={deletePhase}
                  disabled={phaseConfig.length <= 2}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  删除此相位
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                相位名称
              </label>
              <input
                type="text"
                value={currentPhase.name}
                onChange={(e) => updatePhase({ name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  绿灯时间 (秒)
                </label>
                <div className="flex items-center">
                  <button
                    onClick={() => updateTime('greenSeconds', -5)}
                    className="p-2 bg-slate-700 hover:bg-slate-600 rounded-l-lg border border-r-0 border-slate-600 transition-colors"
                  >
                    <MinusIcon className="w-4 h-4 text-slate-200" />
                  </button>
                  <input
                    type="number"
                    min={5}
                    max={120}
                    value={currentPhase.greenSeconds}
                    onChange={(e) => updateTime('greenSeconds', Number(e.target.value) - currentPhase.greenSeconds)}
                    className="w-full px-3 py-2 bg-slate-700 border-y border-slate-600 text-center text-slate-100 focus:outline-none focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => updateTime('greenSeconds', 5)}
                    className="p-2 bg-slate-700 hover:bg-slate-600 rounded-r-lg border border-l-0 border-slate-600 transition-colors"
                  >
                    <PlusIcon className="w-4 h-4 text-slate-200" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  黄灯时间 (秒)
                </label>
                <div className="flex items-center">
                  <button
                    onClick={() => updateTime('yellowSeconds', -1)}
                    disabled={currentPhase.yellowSeconds <= 2}
                    className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded-l-lg border border-r-0 border-slate-600 transition-colors"
                  >
                    <MinusIcon className="w-4 h-4 text-slate-200" />
                  </button>
                  <input
                    type="number"
                    min={2}
                    max={5}
                    value={currentPhase.yellowSeconds}
                    onChange={(e) => updateTime('yellowSeconds', Number(e.target.value) - currentPhase.yellowSeconds)}
                    className="w-full px-3 py-2 bg-slate-700 border-y border-slate-600 text-center text-slate-100 focus:outline-none focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => updateTime('yellowSeconds', 1)}
                    disabled={currentPhase.yellowSeconds >= 5}
                    className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded-r-lg border border-l-0 border-slate-600 transition-colors"
                  >
                    <PlusIcon className="w-4 h-4 text-slate-200" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">
                  红灯清空 (秒)
                </label>
                <div className="flex items-center">
                  <button
                    onClick={() => updateTime('redClearanceSeconds', -1)}
                    disabled={currentPhase.redClearanceSeconds <= 1}
                    className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded-l-lg border border-r-0 border-slate-600 transition-colors"
                  >
                    <MinusIcon className="w-4 h-4 text-slate-200" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={3}
                    value={currentPhase.redClearanceSeconds}
                    onChange={(e) => updateTime('redClearanceSeconds', Number(e.target.value) - currentPhase.redClearanceSeconds)}
                    className="w-full px-3 py-2 bg-slate-700 border-y border-slate-600 text-center text-slate-100 focus:outline-none focus:border-emerald-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => updateTime('redClearanceSeconds', 1)}
                    disabled={currentPhase.redClearanceSeconds >= 3}
                    className="p-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded-r-lg border border-l-0 border-slate-600 transition-colors"
                  >
                    <PlusIcon className="w-4 h-4 text-slate-200" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-slate-200 mb-3">通行方向选择</h4>
              <div className="grid grid-cols-2 gap-4">
                {scenario.approaches.map((approach) => {
                  const laneTypes = getUniqueLaneTypes(approach)
                  const crossings = scenario.pedestrianCrossings.filter(
                    (c) => c.approachId === approach.id
                  )

                  return (
                    <div key={approach.id} className="space-y-2">
                      <h5 className="text-sm font-medium text-slate-400">
                        {DIRECTION_LABEL[approach.direction]}进口
                      </h5>
                      <div className="space-y-1.5">
                        {laneTypes.map((laneType) => {
                          const checked = isMovementChecked(approach.id, laneType)
                          const conflicting = isMovementConflicting(approach.id, laneType)

                          return (
                            <label
                              key={laneType}
                              className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${
                                conflicting
                                  ? 'border border-red-500 bg-red-500/10'
                                  : 'hover:bg-slate-700/50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleMovement(approach.id, laneType)}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                              />
                              <span className={`text-sm ${conflicting ? 'text-red-400' : 'text-slate-300'}`}>
                                {DIRECTION_LABEL[approach.direction]} {LANE_TYPE_LABEL[laneType]}
                              </span>
                              {conflicting && <AlertTriangle className="w-4 h-4 text-red-400 ml-auto" />}
                            </label>
                          )
                        })}
                        {crossings.map((crossing) => {
                          const checked = isPedestrianChecked(crossing.id)

                          return (
                            <label
                              key={crossing.id}
                              className="flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-slate-700/50 transition-colors"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePedestrian(crossing.id)}
                                className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-slate-900"
                              />
                              <span className="text-sm text-slate-300">
                                {DIRECTION_LABEL[approach.direction]} 行人过街
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
