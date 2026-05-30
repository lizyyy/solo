import type { Scenario, PhaseConfig, EvaluationResult, RiskItem, Approach } from '../shared/types.js'

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

function evaluatePhaseConflicts(
  scenario: Scenario,
  phases: PhaseConfig[],
): { risks: RiskItem[]; vehicleScore: number } {
  const risks: RiskItem[] = []
  let totalConflicts = 0
  const approachMap = new Map<string, Approach>(scenario.approaches.map((a) => [a.id, a]))

  for (const phase of phases) {
    const phaseConflicts: [string, string, string, string][] = []
    const movements = phase.movements

    for (let i = 0; i < movements.length; i++) {
      for (let j = i + 1; j < movements.length; j++) {
        const m1 = movements[i]
        const m2 = movements[j]
        const a1 = approachMap.get(m1.approachId)
        const a2 = approachMap.get(m2.approachId)
        if (!a1 || !a2) continue

        if (movementsConflict(a1.direction, m1.laneType, a2.direction, m2.laneType)) {
          phaseConflicts.push([a1.direction, m1.laneType, a2.direction, m2.laneType])
        }
      }
    }

    totalConflicts += phaseConflicts.length
    const level = phaseConflicts.length >= 3 ? 'high' : 'medium'

    for (const [dir1, type1, dir2, type2] of phaseConflicts) {
      risks.push({
        category: 'phase_conflict',
        level,
        description: `Conflict in phase ${phase.name}`,
        businessExplanation: `相位 ${phase.name} 中 ${DIRECTION_LABEL[dir1]}${LANE_TYPE_LABEL[type1]} 与 ${DIRECTION_LABEL[dir2]}${LANE_TYPE_LABEL[type2]} 方向冲突，不可同绿`,
      })
    }
  }

  const vehicleScore = Math.max(0, 100 - totalConflicts * 15)

  return { risks, vehicleScore }
}

function evaluatePedestrianWait(
  scenario: Scenario,
  phases: PhaseConfig[],
): { risks: RiskItem[]; pedestrianScore: number } {
  const risks: RiskItem[] = []
  let pedestrianScore = 100
  const cycleLength = phases.reduce(
    (sum, p) => sum + p.greenSeconds + p.yellowSeconds + p.redClearanceSeconds,
    0,
  )

  for (const crossing of scenario.pedestrianCrossings) {
    const approach = scenario.approaches.find((a) => a.id === crossing.approachId)
    if (!approach) continue

    let maxGreen = 0
    for (const phase of phases) {
      const hasPedestrianMovement = phase.movements.some(
        (m) => m.pedestrianCrossingId === crossing.id,
      )
      const hasStraightMovement = phase.movements.some(
        (m) =>
          m.approachId === crossing.approachId &&
          (m.laneType === 'straight' || m.laneType === 'bus'),
      )
      if ((hasPedestrianMovement || hasStraightMovement) && phase.greenSeconds > maxGreen) {
        maxGreen = phase.greenSeconds
      }
    }

    const maxWait = maxGreen > 0 ? cycleLength - maxGreen : cycleLength

    if (maxWait > 90) {
      const level = maxWait > 120 ? 'high' : 'medium'
      risks.push({
        category: 'pedestrian_wait',
        level,
        description: `Pedestrian wait exceeds 90s at ${approach.direction}`,
        businessExplanation: `${DIRECTION_LABEL[approach.direction]}进口行人最长等待达 ${maxWait} 秒，超过规范上限 90 秒`,
      })

      const overSeconds = maxWait - 90
      pedestrianScore -= Math.ceil(overSeconds / 10) * 10
    }
  }

  pedestrianScore = Math.max(0, pedestrianScore)

  return { risks, pedestrianScore }
}

function evaluateBusPriority(
  scenario: Scenario,
  phases: PhaseConfig[],
): { risks: RiskItem[]; busScore: number } {
  const risks: RiskItem[] = []
  let busScore = 100

  for (const route of scenario.busRoutes) {
    if (route.peakHeadwayMinutes > 8) continue

    let bestGreen = 0
    for (const phase of phases) {
      const hasBus = phase.movements.some(
        (m) => m.laneType === 'bus' && m.approachId === route.approachId,
      )
      if (hasBus && phase.greenSeconds > bestGreen) {
        bestGreen = phase.greenSeconds
      }
    }

    if (bestGreen < 20) {
      const level = bestGreen < 15 ? 'high' : 'medium'
      risks.push({
        category: 'bus_priority',
        level,
        description: `Bus route ${route.name} inadequate green time`,
        businessExplanation: `公交 ${route.name} 高峰班次间隔 ${route.peakHeadwayMinutes} 分钟，未获绿灯延长补偿`,
      })
      busScore -= 20
    }
  }

  busScore = Math.max(0, busScore)

  return { risks, busScore }
}

export function evaluateScenario(
  scenario: Scenario,
  phases: PhaseConfig[],
): EvaluationResult {
  const { risks: conflictRisks, vehicleScore } = evaluatePhaseConflicts(scenario, phases)
  const { risks: pedRisks, pedestrianScore } = evaluatePedestrianWait(scenario, phases)
  const { risks: busRisks, busScore } = evaluateBusPriority(scenario, phases)

  const risks = [...conflictRisks, ...pedRisks, ...busRisks]
  const totalScore = vehicleScore + pedestrianScore + busScore
  const passed = totalScore >= scenario.passThreshold

  const winReasons: string[] = []
  const loseReasons: string[] = []

  if (vehicleScore >= 80) {
    winReasons.push('车辆通行评分达标')
  } else {
    loseReasons.push('车辆通行评分不足')
  }

  if (pedestrianScore >= 80) {
    winReasons.push('行人安全评分达标')
  } else {
    loseReasons.push('行人安全评分不足')
  }

  if (busScore >= 80) {
    winReasons.push('公交优先评分达标')
  } else {
    loseReasons.push('公交优先评分不足')
  }

  return {
    vehicleScore,
    pedestrianScore,
    busScore,
    totalScore,
    passed,
    risks,
    winReasons,
    loseReasons,
  }
}
