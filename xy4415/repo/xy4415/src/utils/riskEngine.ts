import {
  RentalRecord,
  HumidityRecord,
  BowInspection,
  MaintenanceNote,
  ViolinRisk,
  RiskType,
  RentalInfo,
  HumidityInfo,
  BowInspectionInfo,
  DuplicateRentalInfo,
  ReviewNote,
  BlockedViolin
} from '../types'
import { isDateExpired, getDaysDifference, todayString, nowString } from './dateUtils'

const HUMIDITY_LOWER_LIMIT = 40
const HUMIDITY_UPPER_LIMIT = 60

export function assessViolinRisk(
  violinId: string,
  violinName: string,
  rentals: RentalRecord[],
  humidityRecords: HumidityRecord[],
  bowInspections: BowInspection[],
  maintenanceNotes: MaintenanceNote[],
  reviewNotes?: Record<string, ReviewNote>,
  blockedViolins?: BlockedViolin[]
): ViolinRisk {
  const riskTypes: RiskType[] = []
  const details: string[] = []
  let rentalInfo: RentalInfo | undefined
  let humidityInfo: HumidityInfo | undefined
  let bowInspectionInfo: BowInspectionInfo | undefined
  const duplicateRentals: DuplicateRentalInfo[] = []
  
  const activeRentals = rentals.filter(r => r.violinId === violinId && r.status === 'active')
  if (activeRentals.length > 0) {
    const latestRental = activeRentals.reduce((latest, current) => {
      return new Date(current.rentDate) > new Date(latest.rentDate) ? current : latest
    })
    
    const daysOverdue = isDateExpired(latestRental.dueDate) 
      ? getDaysDifference(latestRental.dueDate, todayString()) 
      : 0
    
    rentalInfo = {
      rentalId: latestRental.rentalId,
      studentName: latestRental.studentName,
      rentDate: latestRental.rentDate,
      dueDate: latestRental.dueDate,
      returnDate: latestRental.returnDate,
      daysOverdue: daysOverdue > 0 ? daysOverdue : undefined
    }
    
    if (daysOverdue > 0) {
      riskTypes.push({
        type: 'overdue',
        severity: daysOverdue > 7 ? 'critical' : daysOverdue > 3 ? 'high' : 'medium',
        description: `逾期未归 ${daysOverdue} 天`
      })
      details.push(`租借逾期 ${daysOverdue} 天，学生: ${latestRental.studentName}，应还日期: ${latestRental.dueDate}`)
    }
  }
  
  const violinHumidityRecords = humidityRecords.filter(r => r.violinId === violinId)
  if (violinHumidityRecords.length > 0) {
    const latestRecord = violinHumidityRecords.reduce((latest, current) => {
      return new Date(current.recordTime) > new Date(latest.recordTime) ? current : latest
    })
    
    const humidities = violinHumidityRecords.map(r => r.humidity)
    const minHumidity = Math.min(...humidities)
    const maxHumidity = Math.max(...humidities)
    
    const isOutOfRange = latestRecord.humidity < HUMIDITY_LOWER_LIMIT || latestRecord.humidity > HUMIDITY_UPPER_LIMIT
    
    humidityInfo = {
      latestRecordTime: latestRecord.recordTime,
      latestHumidity: latestRecord.humidity,
      minHumidity,
      maxHumidity,
      isOutOfRange
    }
    
    if (latestRecord.humidity < HUMIDITY_LOWER_LIMIT) {
      const deviation = HUMIDITY_LOWER_LIMIT - latestRecord.humidity
      riskTypes.push({
        type: 'humidity_exceeded',
        severity: deviation > 15 ? 'critical' : deviation > 10 ? 'high' : 'medium',
        description: `湿度过低: ${latestRecord.humidity}% (最低 ${HUMIDITY_LOWER_LIMIT}%)`
      })
      details.push(`琴盒湿度过低: ${latestRecord.humidity}%，正常范围 ${HUMIDITY_LOWER_LIMIT}%-${HUMIDITY_UPPER_LIMIT}%，记录时间: ${latestRecord.recordTime}`)
    }
    
    if (latestRecord.humidity > HUMIDITY_UPPER_LIMIT) {
      const deviation = latestRecord.humidity - HUMIDITY_UPPER_LIMIT
      riskTypes.push({
        type: 'humidity_exceeded',
        severity: deviation > 15 ? 'critical' : deviation > 10 ? 'high' : 'medium',
        description: `湿度过高: ${latestRecord.humidity}% (最高 ${HUMIDITY_UPPER_LIMIT}%)`
      })
      details.push(`琴盒湿度过高: ${latestRecord.humidity}%，正常范围 ${HUMIDITY_LOWER_LIMIT}%-${HUMIDITY_UPPER_LIMIT}%，记录时间: ${latestRecord.recordTime}`)
    }
  }
  
  const violinBowInspections = bowInspections.filter(i => i.violinId === violinId)
  if (violinBowInspections.length > 0) {
    const latestInspection = violinBowInspections.reduce((latest, current) => {
      return new Date(current.inspectionDate) > new Date(latest.inspectionDate) ? current : latest
    })
    
    const allIssues = [...latestInspection.bowHairIssues, ...latestInspection.rosinIssues]
    
    bowInspectionInfo = {
      inspectionDate: latestInspection.inspectionDate,
      bowHairCondition: latestInspection.bowHairCondition,
      rosinCondition: latestInspection.rosinCondition,
      overallStatus: latestInspection.overallStatus,
      issues: allIssues
    }
    
    if (latestInspection.overallStatus === 'fail') {
      riskTypes.push({
        type: 'bow_damage_unrepaired',
        severity: 'critical',
        description: '弓毛/松香点检不合格，需立即维修'
      })
      details.push(`弓毛/松香点检不合格。弓毛状态: ${latestInspection.bowHairCondition}，松香状态: ${latestInspection.rosinCondition}，问题: ${allIssues.join('、') || '无详细问题'}，点检日期: ${latestInspection.inspectionDate}`)
    } else if (latestInspection.overallStatus === 'needs_maintenance') {
      riskTypes.push({
        type: 'bow_damage_unrepaired',
        severity: 'high',
        description: '弓毛/松香需要维护'
      })
      details.push(`弓毛/松香需要维护。弓毛状态: ${latestInspection.bowHairCondition}，松香状态: ${latestInspection.rosinCondition}，问题: ${allIssues.join('、') || '无详细问题'}，点检日期: ${latestInspection.inspectionDate}`)
    } else if (latestInspection.bowHairCondition === 'poor' || latestInspection.rosinCondition === 'poor') {
      riskTypes.push({
        type: 'bow_damage_unrepaired',
        severity: 'medium',
        description: '弓毛或松香状态较差'
      })
      details.push(`弓毛状态: ${latestInspection.bowHairCondition}，松香状态: ${latestInspection.rosinCondition}，建议检查维护，点检日期: ${latestInspection.inspectionDate}`)
    }
  }
  
  const pendingMaintenances = maintenanceNotes.filter(
    m => m.violinId === violinId && m.status !== 'completed'
  )
  
  if (pendingMaintenances.length > 0) {
    for (const maintenance of pendingMaintenances) {
      riskTypes.push({
        type: 'pending_maintenance',
        severity: maintenance.status === 'in_progress' ? 'medium' : 'high',
        description: `存在待维修项目: ${maintenance.issueType}`
      })
      details.push(`待维修项目 - 类型: ${maintenance.issueType}，描述: ${maintenance.description}，状态: ${maintenance.status}，创建日期: ${maintenance.createDate}`)
    }
  }
  
  const activeRentalsForDuplicate = rentals.filter(
    r => r.violinId === violinId && r.status === 'active'
  )
  
  for (let i = 0; i < activeRentalsForDuplicate.length; i++) {
    for (let j = i + 1; j < activeRentalsForDuplicate.length; j++) {
      const r1 = activeRentalsForDuplicate[i]
      const r2 = activeRentalsForDuplicate[j]
      
      const r1Start = new Date(r1.rentDate)
      const r1End = new Date(r1.dueDate)
      const r2Start = new Date(r2.rentDate)
      const r2End = new Date(r2.dueDate)
      
      if (r1Start <= r2End && r2Start <= r1End) {
        duplicateRentals.push({
          rentalId: r1.rentalId,
          studentName: r1.studentName,
          rentDate: r1.rentDate,
          dueDate: r1.dueDate,
          conflictRentalId: r2.rentalId,
          conflictStudentName: r2.studentName
        })
      }
    }
  }
  
  if (duplicateRentals.length > 0) {
    riskTypes.push({
      type: 'duplicate_rental',
      severity: 'critical',
      description: `存在 ${duplicateRentals.length} 个时间重叠的重复预约`
    })
    const studentNames = [...new Set(duplicateRentals.flatMap(d => [d.studentName, d.conflictStudentName]))]
    details.push(`发现同一琴号存在时间重叠的预约，涉及学生: ${studentNames.join('、')}`)
  }
  
  let riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'none' = 'none'
  if (riskTypes.some(r => r.severity === 'critical')) {
    riskLevel = 'critical'
  } else if (riskTypes.some(r => r.severity === 'high')) {
    riskLevel = 'high'
  } else if (riskTypes.some(r => r.severity === 'medium')) {
    riskLevel = 'medium'
  } else if (riskTypes.some(r => r.severity === 'low')) {
    riskLevel = 'low'
  }
  
  let isBlocked = false
  let blockReason: string | undefined
  let blockedBy: string | undefined
  let blockedAt: string | undefined
  
  if (blockedViolins) {
    const blocked = blockedViolins.find(b => b.violinId === violinId)
    if (blocked) {
      isBlocked = true
      blockReason = blocked.reason
      blockedBy = blocked.blockedBy
      blockedAt = blocked.blockedAt
    }
  }
  
  let reviewNote: ReviewNote | undefined
  if (reviewNotes && reviewNotes[violinId]) {
    reviewNote = reviewNotes[violinId]
  }
  
  return {
    id: `violin_${violinId}`,
    violinId,
    violinName: violinName || `提琴 ${violinId}`,
    riskLevel,
    riskTypes,
    details,
    rentalInfo,
    humidityInfo,
    bowInspectionInfo,
    duplicateRentals: duplicateRentals.length > 0 ? duplicateRentals : undefined,
    reviewNotes: reviewNote?.notes,
    reviewedBy: reviewNote?.reviewedBy,
    reviewedAt: reviewNote?.reviewedAt,
    isBlocked,
    blockReason,
    blockedBy,
    blockedAt
  }
}

export function assessAllRisks(
  rentals: RentalRecord[],
  humidityRecords: HumidityRecord[],
  bowInspections: BowInspection[],
  maintenanceNotes: MaintenanceNote[],
  reviewNotes?: Record<string, ReviewNote>,
  blockedViolins?: BlockedViolin[]
): ViolinRisk[] {
  const violinIds = new Set<string>()
  
  rentals.forEach(r => violinIds.add(r.violinId))
  humidityRecords.forEach(r => violinIds.add(r.violinId))
  bowInspections.forEach(i => violinIds.add(i.violinId))
  maintenanceNotes.forEach(m => violinIds.add(m.violinId))
  
  const risks: ViolinRisk[] = []
  
  for (const violinId of violinIds) {
    const violinName = getViolinName(violinId, rentals, humidityRecords, bowInspections, maintenanceNotes)
    risks.push(assessViolinRisk(
      violinId,
      violinName,
      rentals,
      humidityRecords,
      bowInspections,
      maintenanceNotes,
      reviewNotes,
      blockedViolins
    ))
  }
  
  return risks.sort((a, b) => {
    const priority: Record<string, number> = {
      critical: 5,
      high: 4,
      medium: 3,
      low: 2,
      none: 1
    }
    
    if (a.isBlocked && !b.isBlocked) return -1
    if (!a.isBlocked && b.isBlocked) return 1
    
    const priorityDiff = priority[b.riskLevel] - priority[a.riskLevel]
    if (priorityDiff !== 0) return priorityDiff
    
    return a.violinId.localeCompare(b.violinId)
  })
}

function getViolinName(
  violinId: string,
  rentals: RentalRecord[],
  humidityRecords: HumidityRecord[],
  bowInspections: BowInspection[],
  maintenanceNotes: MaintenanceNote[]
): string {
  const rental = rentals.find(r => r.violinId === violinId && r.violinName)
  if (rental?.violinName) return rental.violinName
  
  const humidity = humidityRecords.find(r => r.violinId === violinId && r.violinName)
  if (humidity?.violinName) return humidity.violinName
  
  const inspection = bowInspections.find(i => i.violinId === violinId && i.violinName)
  if (inspection?.violinName) return inspection.violinName
  
  const maintenance = maintenanceNotes.find(m => m.violinId === violinId && m.violinName)
  if (maintenance?.violinName) return maintenance.violinName
  
  return `提琴 ${violinId}`
}

export function getRiskLevelColor(riskLevel: string): string {
  switch (riskLevel) {
    case 'critical': return '#ef4444'
    case 'high': return '#f97316'
    case 'medium': return '#eab308'
    case 'low': return '#22c55e'
    default: return '#6b7280'
  }
}

export function getRiskLevelText(riskLevel: string): string {
  switch (riskLevel) {
    case 'critical': return '严重'
    case 'high': return '高风险'
    case 'medium': return '中风险'
    case 'low': return '低风险'
    default: return '正常'
  }
}

export function getRiskTypeText(type: string): string {
  switch (type) {
    case 'overdue': return '逾期未归'
    case 'humidity_exceeded': return '湿度超限'
    case 'bow_damage_unrepaired': return '弓毛损伤未维修'
    case 'duplicate_rental': return '重复预约'
    case 'pending_maintenance': return '待维修'
    default: return type
  }
}

export function getIssueTypeText(type: string): string {
  switch (type) {
    case 'bow_hair': return '弓毛'
    case 'rosin': return '松香'
    case 'bridge': return '琴桥'
    case 'strings': return '琴弦'
    case 'case': return '琴盒'
    case 'other': return '其他'
    default: return type
  }
}

export function getConditionText(condition: string): string {
  switch (condition) {
    case 'excellent': return '优秀'
    case 'good': return '良好'
    case 'fair': return '一般'
    case 'poor': return '较差'
    default: return condition
  }
}

export function getStatusText(status: string): string {
  switch (status) {
    case 'active': return '进行中'
    case 'returned': return '已归还'
    case 'overdue': return '逾期'
    case 'pass': return '通过'
    case 'needs_maintenance': return '需维护'
    case 'fail': return '不合格'
    case 'pending': return '待处理'
    case 'in_progress': return '进行中'
    case 'completed': return '已完成'
    default: return status
  }
}
