import { RISK_TYPES, RISK_LEVELS } from './dataModels'

// 计算两个日期之间的天数差
function daysBetween(date1, date2) {
  const d1 = new Date(date1)
  const d2 = new Date(date2)
  const diffTime = Math.abs(d2 - d1)
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

// 检查日期是否已过期
function isOverdue(date) {
  if (!date) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const checkDate = new Date(date)
  checkDate.setHours(0, 0, 0, 0)
  return checkDate < today
}

// 计算电池剩余天数
function getBatteryRemainingDays(lastChange, lifeMonths) {
  if (!lastChange) return Infinity
  const lastChangeDate = new Date(lastChange)
  const lifeDays = lifeMonths * 30
  const today = new Date()
  const daysPassed = daysBetween(lastChangeDate, today)
  return Math.max(0, lifeDays - daysPassed)
}

// 评估电池风险
function assessBatteryRisk(deviceInfo) {
  if (!deviceInfo || !deviceInfo.lastBatteryChange) {
    return { type: null, reason: '', level: null }
  }

  const remainingDays = getBatteryRemainingDays(
    deviceInfo.lastBatteryChange,
    deviceInfo.batteryLifeMonths || 3
  )

  if (remainingDays <= 0) {
    return {
      type: RISK_TYPES.BATTERY,
      reason: `电池已过期（上次更换：${deviceInfo.lastBatteryChange}），请立即更换。`,
      level: RISK_LEVELS.HIGH
    }
  } else if (remainingDays <= 7) {
    return {
      type: RISK_TYPES.BATTERY,
      reason: `电池即将耗尽，剩余约 ${remainingDays} 天（电池类型：${deviceInfo.batteryType || '未知'}）。`,
      level: RISK_LEVELS.MEDIUM
    }
  } else if (remainingDays <= 14) {
    return {
      type: RISK_TYPES.BATTERY,
      reason: `电池剩余约 ${remainingDays} 天，建议近期准备更换。`,
      level: RISK_LEVELS.LOW
    }
  }

  return { type: null, reason: '', level: null }
}

// 评估参数调整风险
function assessAdjustmentRisk(deviceInfo, hearingScreening) {
  const risks = []

  if (deviceInfo && deviceInfo.lastAdjustment) {
    const daysSinceAdjustment = daysBetween(deviceInfo.lastAdjustment, new Date())
    if (daysSinceAdjustment > 90) {
      risks.push({
        type: RISK_TYPES.ADJUST,
        reason: `距上次参数调整已超过 3 个月（${daysSinceAdjustment} 天），建议重新评估听力并调整参数。`,
        level: RISK_LEVELS.MEDIUM
      })
    }
  }

  if (hearingScreening) {
    const maxPta = Math.max(
      hearingScreening.leftEar?.pta || 0,
      hearingScreening.rightEar?.pta || 0
    )
    
    if (maxPta > 70) {
      risks.push({
        type: RISK_TYPES.ADJUST,
        reason: `听力损失较严重（PTA: ${maxPta} dB），建议检查助听参数设置是否合适。`,
        level: RISK_LEVELS.HIGH
      })
    } else if (maxPta > 55) {
      risks.push({
        type: RISK_TYPES.ADJUST,
        reason: `听力损失中度偏重度（PTA: ${maxPta} dB），建议定期评估助听效果。`,
        level: RISK_LEVELS.MEDIUM
      })
    }

    if (hearingScreening.speechRecognition && hearingScreening.speechRecognition < 60) {
      risks.push({
        type: RISK_TYPES.ADJUST,
        reason: `言语识别率较低（${hearingScreening.speechRecognition}%），可能需要调整助听参数或评估助听效果。`,
        level: RISK_LEVELS.HIGH
      })
    }
  }

  return risks
}

// 评估维修未归还风险
function assessOverdueRisk(repairRecords) {
  if (!repairRecords || repairRecords.length === 0) {
    return []
  }

  const risks = []
  repairRecords.forEach(record => {
    if (record.status === 'pending' || !record.returnDate) {
      if (record.repairDate) {
        const daysSinceRepair = daysBetween(record.repairDate, new Date())
        if (daysSinceRepair > 14) {
          risks.push({
            type: RISK_TYPES.OVERDUE,
            reason: `设备送修已 ${daysSinceRepair} 天未归还（送修日期：${record.repairDate}，问题：${record.problemDescription}），请跟进。`,
            level: RISK_LEVELS.HIGH
          })
        } else if (daysSinceRepair > 7) {
          risks.push({
            type: RISK_TYPES.OVERDUE,
            reason: `设备送修已 ${daysSinceRepair} 天，预计近期可归还，请留意。`,
            level: RISK_LEVELS.LOW
          })
        }
      }
    }
  })

  return risks
}

// 评估优先回访风险
function assessPriorityRisk(elderly, hearingScreening, nextAppointment) {
  const risks = []

  if (hearingScreening) {
    if (hearingScreening.earDischarge) {
      risks.push({
        type: RISK_TYPES.PRIORITY,
        reason: `存在耳漏情况，建议优先回访并建议就医检查。`,
        level: RISK_LEVELS.HIGH
      })
    }

    if (hearingScreening.tinnitus && hearingScreening.tinnitus === true) {
      risks.push({
        type: RISK_TYPES.PRIORITY,
        reason: `有耳鸣症状，建议优先回访了解情况。`,
        level: RISK_LEVELS.MEDIUM
      })
    }
  }

  if (nextAppointment && nextAppointment.date) {
    const daysUntilAppointment = daysBetween(new Date(), nextAppointment.date)
    
    if (isOverdue(nextAppointment.date) && nextAppointment.status === 'scheduled') {
      risks.push({
        type: RISK_TYPES.PRIORITY,
        reason: `预约已过期（原预约日期：${nextAppointment.date}），请尽快安排回访。`,
        level: RISK_LEVELS.HIGH
      })
    } else if (daysUntilAppointment <= 3 && nextAppointment.status === 'scheduled') {
      risks.push({
        type: RISK_TYPES.PRIORITY,
        reason: `预约即将到期（${nextAppointment.date} ${nextAppointment.time || ''}），请提前准备。`,
        level: RISK_LEVELS.MEDIUM
      })
    }
  }

  if (elderly.age > 80) {
    risks.push({
      type: RISK_TYPES.PRIORITY,
      reason: `高龄老人（${elderly.age} 岁），建议优先关注。`,
      level: RISK_LEVELS.LOW
    })
  }

  return risks
}

// 综合评估老人风险
export function assessElderlyRisk(elderly) {
  const allRisks = []

  const batteryRisk = assessBatteryRisk(elderly.deviceInfo)
  if (batteryRisk.type) {
    allRisks.push(batteryRisk)
  }

  const adjustmentRisks = assessAdjustmentRisk(elderly.deviceInfo, elderly.hearingScreening)
  allRisks.push(...adjustmentRisks)

  const overdueRisks = assessOverdueRisk(elderly.repairRecords)
  allRisks.push(...overdueRisks)

  const priorityRisks = assessPriorityRisk(elderly, elderly.hearingScreening, elderly.nextAppointment)
  allRisks.push(...priorityRisks)

  if (allRisks.length === 0) {
    return {
      risks: [{ type: RISK_TYPES.NORMAL, reason: '各项指标正常，建议定期回访。', level: RISK_LEVELS.NORMAL }],
      overallLevel: RISK_LEVELS.NORMAL,
      hasRisks: false
    }
  }

  const levelOrder = {
    [RISK_LEVELS.HIGH]: 3,
    [RISK_LEVELS.MEDIUM]: 2,
    [RISK_LEVELS.LOW]: 1,
    [RISK_LEVELS.NORMAL]: 0
  }

  let overallLevel = RISK_LEVELS.NORMAL
  allRisks.forEach(risk => {
    if (levelOrder[risk.level] > levelOrder[overallLevel]) {
      overallLevel = risk.level
    }
  })

  return {
    risks: allRisks,
    overallLevel,
    hasRisks: true
  }
}

// 根据风险等级筛选老人
export function filterByRiskLevel(elderlyList, level) {
  if (level === 'all') return elderlyList

  return elderlyList.filter(elderly => {
    const assessment = assessElderlyRisk(elderly)
    return assessment.overallLevel === level
  })
}

// 按风险优先级排序老人列表
export function sortByRiskPriority(elderlyList) {
  const levelOrder = {
    [RISK_LEVELS.HIGH]: 0,
    [RISK_LEVELS.MEDIUM]: 1,
    [RISK_LEVELS.LOW]: 2,
    [RISK_LEVELS.NORMAL]: 3
  }

  return [...elderlyList].sort((a, b) => {
    const assessmentA = assessElderlyRisk(a)
    const assessmentB = assessElderlyRisk(b)
    return levelOrder[assessmentA.overallLevel] - levelOrder[assessmentB.overallLevel]
  })
}
