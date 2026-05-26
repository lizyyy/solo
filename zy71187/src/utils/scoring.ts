import type { Level, ScoreResult, ScoreBreakdown } from '@/types'

export function computeCorrectDeposit(level: Level): Record<string, number> {
  const result: Record<string, number> = {}

  for (const rule of level.depositRules) {
    const equipment = level.equipment.find((e) => e.id === rule.equipmentId)
    if (!equipment) continue

    let amount = rule.baseAmount

    const itemDamages = level.damages.filter(
      (d) => d.equipmentId === rule.equipmentId && !d.isNormalWear,
    )

    for (const dmg of itemDamages) {
      if (dmg.severity === 'minor') {
        amount += rule.baseAmount * rule.scratchMultiplier
      } else if (dmg.severity === 'major') {
        amount += rule.baseAmount * rule.scratchMultiplier * 2
      } else if (dmg.severity === 'fatal') {
        amount += rule.baseAmount * rule.scratchMultiplier * 5
      }
    }

    const itemAccessories = level.accessories.filter(
      (a) => a.equipmentId === rule.equipmentId,
    )
    const missingCount = itemAccessories.filter((a) => a.isMissing).length
    amount += missingCount * rule.missingPartPenalty

    if (equipment.batteryLevel !== undefined && equipment.batteryLevel < 0.5) {
      amount += rule.lowBatteryPenalty
    }

    result[rule.equipmentId] = Math.round(amount)
  }

  return result
}

export function calculateScore(
  level: Level,
  playerMatched: Record<string, string>,
  playerMarkedDamages: Record<string, string>,
  playerDeposits: Record<string, number>,
  markedNormalWears: string[],
  identifiedRedHerrings: string[],
  timeRemaining: number,
  totalTime: number,
): ScoreResult {
  let accessoryScore = 0
  let damageScore = 0
  let depositScore = 0
  let normalWearScore = 0
  let redHerringScore = 0
  const failures: string[] = []

  const correctMatches: Record<string, string> = {}
  for (const acc of level.accessories) {
    correctMatches[acc.id] = acc.isMissing ? '__missing__' : acc.equipmentId
  }

  for (const acc of level.accessories) {
    const playerMatch = playerMatched[acc.id]
    const correctMatch = correctMatches[acc.id]

    if (acc.isMissing) {
      if (playerMatch === '__missing__') {
        accessoryScore += 5
      } else if (playerMatch && playerMatch !== '__missing__') {
        accessoryScore -= 15
        failures.push(`错误匹配：${acc.name} 实际已缺失`)
      } else {
        accessoryScore -= 10
        failures.push(`漏识别：${acc.name} 已缺失`)
      }
    } else {
      if (playerMatch === acc.equipmentId) {
        accessoryScore += 10
      } else {
        accessoryScore -= 15
        failures.push(`配件匹配错误：${acc.name}`)
      }
    }
  }

  const correctDamages: Record<string, string> = {}
  for (const dmg of level.damages) {
    if (!dmg.isNormalWear) {
      correctDamages[dmg.id] = dmg.equipmentId
    }
  }

  for (const dmg of level.damages) {
    const playerMarked = playerMarkedDamages[dmg.id]

    if (dmg.isNormalWear) {
      if (playerMarked) {
        damageScore -= 10
        failures.push(`误记正常使用痕迹为损伤：${dmg.description}`)
      } else if (markedNormalWears.includes(dmg.id)) {
        normalWearScore += 5
      } else {
        normalWearScore -= 5
      }
    } else {
      if (playerMarked) {
        damageScore += dmg.severity === 'fatal' ? 25 : dmg.severity === 'major' ? 20 : 15
      } else {
        damageScore -= dmg.severity === 'fatal' ? 25 : 20
        failures.push(`漏记损伤：${dmg.description}`)
      }
    }
  }

  for (const rh of level.redHerrings) {
    if (identifiedRedHerrings.includes(rh.id)) {
      redHerringScore += 10
    } else {
      redHerringScore -= 5
    }
  }

  const correctDepositAmounts = computeCorrectDeposit(level)

  for (const rule of level.depositRules) {
    const playerCalc = playerDeposits[rule.equipmentId] || 0
    const correct = correctDepositAmounts[rule.equipmentId] || 0

    if (Math.abs(playerCalc - correct) <= 5) {
      depositScore += 20
    } else {
      depositScore -= 25
      failures.push(`押金计算错误：${level.equipment.find((e) => e.id === rule.equipmentId)?.name}`)
    }
  }

  const timeBonus = Math.floor(timeRemaining * 0.5)
  const timeUsed = totalTime - timeRemaining
  const speedBonus = timeUsed <= 30 && failures.length === 0 ? 50 : 0

  const total = accessoryScore + damageScore + depositScore + normalWearScore + redHerringScore + timeBonus + speedBonus

  let passed = total >= 80
  let needsTraining = total >= 60 && total < 80

  if (failures.some((f) => f.includes('漏记损伤') && f.includes('严重'))) {
    passed = false
  }

  const depositFailures = failures.filter((f) => f.includes('押金计算错误')).length
  if (depositFailures >= 3) {
    passed = false
  }

  const breakdown: ScoreBreakdown = {
    accessoryScore,
    damageScore,
    depositScore,
    normalWearScore,
    redHerringScore,
    timeBonus,
    speedBonus,
    total,
  }

  return {
    score: total,
    breakdown,
    failures,
    passed,
    needsTraining,
    correctDepositAmounts,
    playerDepositAmounts: playerDeposits,
    matchedAccessories: playerMatched,
    correctAccessoryMatches: correctMatches,
    markedDamages: playerMarkedDamages,
    correctDamages,
    markedNormalWears,
    identifiedRedHerrings,
  }
}
