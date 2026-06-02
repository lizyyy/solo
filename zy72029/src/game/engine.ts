import type { Material, GameSlot, OperationLog, FailureReason, GameState } from '@/types'
import { boundaryScoreConfig } from '@/data/mockMaterials'

export function validatePlacement(material: Material, slot: GameSlot, placedMaterials: Record<string, string>): {
  isCorrect: boolean
  scoreDelta: number
  riskDelta: number
  resourceDelta: number
  rawNote?: string
} {
  const isSameMaterialAlreadyInSlot = placedMaterials[material.id] === slot.id

  if (isSameMaterialAlreadyInSlot) {
    return {
      isCorrect: false,
      scoreDelta: -3,
      riskDelta: 5,
      resourceDelta: 0,
      rawNote: '【系统】同一材料重复放入同一槽位，重复放置扣分',
    }
  }

  const isCorrectSlot = material.correctSlot === slot.id
  const isCategoryAccepted = slot.acceptedCategories.includes(material.category)

  if (isCorrectSlot) {
    return {
      isCorrect: true,
      scoreDelta: 10,
      riskDelta: -2,
      resourceDelta: 1,
    }
  }

  if (isCategoryAccepted && !isCorrectSlot) {
    return {
      isCorrect: false,
      scoreDelta: 2,
      riskDelta: 3,
      resourceDelta: 0,
      rawNote: `【边缘正确】${material.title}的类别"${material.category}"被"${slot.label}"接受，但不是最佳匹配位置`,
    }
  }

  return {
    isCorrect: false,
    scoreDelta: -5,
    riskDelta: 8,
    resourceDelta: -1,
    rawNote: `【错误匹配】${material.title}不应该放在"${slot.label}"，类别不匹配`,
  }
}

export function diagnoseFailure(state: GameState): {
  reason: FailureReason
  details: string[]
} {
  const details: string[] = []
  const incorrectOps = state.operationLogs.filter(op => op.isCorrect === false && op.operationType === 'place')
  const avgResponseTime = calculateAvgResponseTime(state.operationLogs)
  const errorRate = incorrectOps.length / Math.max(state.operationLogs.filter(op => op.operationType === 'place').length, 1)
  const misplacedDetails = getMisplacedDetails(state)

  if (misplacedDetails.length > 0 && Object.keys(state.placedMaterials).length === state.materials.length) {
    details.push(`材料已全部放置，但有${misplacedDetails.length}份材料位置错误`)
    misplacedDetails.forEach((d, i) => {
      details.push(`错放${i + 1}：${d}`)
    })
    details.push('【判定依据】所有材料均已放置但存在错放，判定为对理赔材料分类规则理解不足')
    return {
      reason: 'rule_misunderstanding',
      details,
    }
  }

  if (state.timeRemaining <= 0 && state.risk < state.riskThreshold) {
    details.push(`时间耗尽：总时长${state.totalTime}秒，已全部用完`)
    details.push(`已完成匹配：${Object.keys(state.placedMaterials).length}/${state.materials.length}份材料`)
    details.push(`平均响应时间：${avgResponseTime.toFixed(1)}秒/次操作`)
    
    if (avgResponseTime > 15) {
      details.push('【判定依据】单次操作平均耗时超过15秒，判定为操作速度不足')
    } else {
      details.push('【判定依据】虽单次操作速度尚可，但整体时间管理不当导致超时')
    }
    
    return {
      reason: 'timeout',
      details,
    }
  }

  if (state.risk >= state.riskThreshold) {
    details.push(`风险值过高：当前${state.risk}，阈值${state.riskThreshold}`)
    details.push(`错误匹配次数：${incorrectOps.length}次`)
    details.push(`错误率：${(errorRate * 100).toFixed(0)}%`)
    
    incorrectOps.slice(0, 3).forEach((op, idx) => {
      const material = state.materials.find(m => m.id === op.materialId)
      const slot = state.slots.find(s => s.id === op.targetSlot)
      if (material && slot) {
        details.push(`错误${idx + 1}：将"${material.title}"放入"${slot.label}"`)
      }
    })

    if (errorRate > 0.4) {
      details.push('【判定依据】错误匹配率超过40%，判定为对理赔材料分类规则理解不足')
    } else {
      details.push('【判定依据】虽错误率不高，但关键位置连续出错导致风险累积过快')
    }

    return {
      reason: 'rule_misunderstanding',
      details,
    }
  }

  details.push('游戏正常完成')
  return {
    reason: 'timeout',
    details,
  }
}

export function calculateAvgResponseTime(logs: OperationLog[]): number {
  if (logs.length < 2) return 0
  
  let total = 0
  for (let i = 1; i < logs.length; i++) {
    const prev = new Date(logs[i - 1].timestamp).getTime()
    const curr = new Date(logs[i].timestamp).getTime()
    total += curr - prev
  }
  
  return total / (logs.length - 1) / 1000
}

export function checkBoundaryCondition(score: number): {
  isBoundary: boolean
  message: string
} {
  const diff = Math.abs(score - boundaryScoreConfig.passScore)
  if (diff <= 2) {
    return {
      isBoundary: true,
      message: `【边界分数】当前得分${score}分，距离及格线${boundaryScoreConfig.passScore}分仅${score >= boundaryScoreConfig.passScore ? '超过' : '差'}${diff}分`,
    }
  }
  return {
    isBoundary: false,
    message: '',
  }
}

export function isGameComplete(state: GameState): boolean {
  if (Object.keys(state.placedMaterials).length !== state.materials.length) {
    return false
  }
  return state.materials.every(m => state.placedMaterials[m.id] === m.correctSlot)
}

export function hasMisplacedMaterials(state: GameState): boolean {
  return state.materials.some(
    m => state.placedMaterials[m.id] && state.placedMaterials[m.id] !== m.correctSlot
  )
}

export function getMisplacedDetails(state: GameState): string[] {
  const details: string[] = []
  state.materials.forEach(m => {
    const placedSlot = state.placedMaterials[m.id]
    if (placedSlot && placedSlot !== m.correctSlot) {
      const slotLabel = state.slots.find(s => s.id === placedSlot)?.label || placedSlot
      const correctLabel = state.slots.find(s => s.id === m.correctSlot)?.label || m.correctSlot
      details.push(`"${m.title}"放在了"${slotLabel}"，正确位置应为"${correctLabel}"`)
    }
  })
  return details
}

export function generateKeyDecisions(state: GameState): string[] {
  const decisions: string[] = []
  
  if (state.failureReason === 'rule_misunderstanding') {
    decisions.push('失败原因判定：规则理解错误（风险值过高触发）')
  } else if (state.failureReason === 'timeout') {
    decisions.push('失败原因判定：操作超时（时间耗尽触发）')
  } else if (state.status === 'completed') {
    decisions.push('成功完成：所有材料正确匹配')
  }

  const boundary = checkBoundaryCondition(state.score)
  if (boundary.isBoundary) {
    decisions.push(boundary.message)
  }

  const pauseCount = state.pauseRecords.length
  if (pauseCount > 0) {
    decisions.push(`练习过程中暂停${pauseCount}次，其中${state.pauseRecords.filter(p => p.isIntentional).length}次为教师故意打断`)
  }

  const supplementCount = state.supplementNotes.length
  if (supplementCount > 0) {
    decisions.push(`教师补录备注${supplementCount}条，已标记与原始记录的差异`)
  }

  const mistakeOps = state.operationLogs.filter(op => op.rawNote?.includes('【新手误操作】'))
  if (mistakeOps.length > 0) {
    decisions.push(`包含${mistakeOps.length}条预设新手误操作记录，用于教学对比`)
  }

  decisions.push(`材料来源：${state.materialPack.source}（${state.materialPack.name}）`)
  decisions.push(`练习学生：${state.studentName}`)

  return decisions
}
