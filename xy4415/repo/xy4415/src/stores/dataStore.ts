import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  RentalRecord,
  HumidityRecord,
  BowInspection,
  MaintenanceNote,
  ViolinRisk,
  ReviewNote,
  BlockedViolin,
  AuditRecord,
  AppData,
  ImportResult,
  MaintenanceItem
} from '../types'
import { assessAllRisks } from '../utils/riskEngine'
import { todayString, nowString } from '../utils/dateUtils'
import {
  parseRentalRecordCsv,
  parseHumidityRecordCsv,
  parseBowInspectionJson,
  parseMaintenanceNoteJson
} from '../utils/csvParser'

export const useDataStore = defineStore('data', () => {
  const rentalRecords = ref<RentalRecord[]>([])
  const humidityRecords = ref<HumidityRecord[]>([])
  const bowInspections = ref<BowInspection[]>([])
  const maintenanceNotes = ref<MaintenanceNote[]>([])
  const reviewNotes = ref<Record<string, ReviewNote>>({})
  const blockedViolins = ref<BlockedViolin[]>([])
  const auditLogs = ref<AuditRecord[]>([])
  
  const lastUpdated = ref<string>('')
  const dataDate = ref<string>(todayString())
  
  const violinRisks = computed<ViolinRisk[]>(() => {
    return assessAllRisks(
      rentalRecords.value,
      humidityRecords.value,
      bowInspections.value,
      maintenanceNotes.value,
      reviewNotes.value,
      blockedViolins.value
    )
  })
  
  const criticalRisks = computed(() => 
    violinRisks.value.filter(r => r.riskLevel === 'critical' && !r.isBlocked)
  )
  
  const highRisks = computed(() => 
    violinRisks.value.filter(r => r.riskLevel === 'high' && !r.isBlocked)
  )
  
  const mediumRisks = computed(() => 
    violinRisks.value.filter(r => r.riskLevel === 'medium' && !r.isBlocked)
  )
  
  const lowRisks = computed(() => 
    violinRisks.value.filter(r => r.riskLevel === 'low' && !r.isBlocked)
  )
  
  const noRisks = computed(() => 
    violinRisks.value.filter(r => r.riskLevel === 'none' && !r.isBlocked)
  )
  
  const blockedList = computed(() => 
    violinRisks.value.filter(r => r.isBlocked)
  )
  
  const todayBlocked = computed(() => 
    blockedViolins.value.filter(b => b.blockedAt.startsWith(todayString()))
  )
  
  const statistics = computed(() => ({
    totalViolins: violinRisks.value.length,
    criticalCount: criticalRisks.value.length,
    highCount: highRisks.value.length,
    mediumCount: mediumRisks.value.length,
    lowCount: lowRisks.value.length,
    normalCount: noRisks.value.length,
    blockedCount: blockedList.value.length,
    rentalCount: rentalRecords.value.length,
    activeRentalCount: rentalRecords.value.filter(r => r.status === 'active').length,
    overdueCount: rentalRecords.value.filter(r => r.status === 'overdue').length,
    humidityCount: humidityRecords.value.length,
    inspectionCount: bowInspections.value.length,
    maintenanceCount: maintenanceNotes.value.length,
    pendingMaintenanceCount: maintenanceNotes.value.filter(m => m.status !== 'completed').length
  }))

  function addAuditLog(action: string, details: string, violinId?: string, violinName?: string) {
    const log: AuditRecord = {
      id: `audit_${Date.now()}`,
      action,
      violinId,
      violinName,
      details,
      performedBy: '当前用户',
      timestamp: nowString()
    }
    auditLogs.value.unshift(log)
    if (auditLogs.value.length > 1000) {
      auditLogs.value = auditLogs.value.slice(0, 1000)
    }
    lastUpdated.value = nowString()
  }
  
  function importRentalRecords(csvContent: string): ImportResult<RentalRecord> {
    const result = parseRentalRecordCsv(csvContent)
    if (result.data) {
      rentalRecords.value = result.data
      addAuditLog('导入数据', `成功导入 ${result.count} 条租借记录`)
    }
    return result
  }
  
  function importHumidityRecords(csvContent: string): ImportResult<HumidityRecord> {
    const result = parseHumidityRecordCsv(csvContent)
    if (result.data) {
      humidityRecords.value = result.data
      addAuditLog('导入数据', `成功导入 ${result.count} 条湿度记录`)
    }
    return result
  }
  
  function importBowInspections(jsonContent: string): ImportResult<BowInspection> {
    const result = parseBowInspectionJson(jsonContent)
    if (result.data && result.data.length > 0) {
      bowInspections.value = result.data
      addAuditLog('导入数据', `成功导入 ${result.count} 条弓毛/松香点检记录`)
    }
    return result as ImportResult<BowInspection>
  }
  
  function importMaintenanceNotes(jsonContent: string): ImportResult<MaintenanceNote> {
    const result = parseMaintenanceNoteJson(jsonContent)
    if (result.data) {
      maintenanceNotes.value = result.data
      addAuditLog('导入数据', `成功导入 ${result.count} 条维修备注`)
    }
    return result as ImportResult<MaintenanceNote>
  }
  
  function addReviewNote(
    violinId: string,
    notes: string,
    decision: 'ok' | 'block' | 'maintenance'
  ) {
    const violinRisk = violinRisks.value.find(r => r.violinId === violinId)
    const violinName = violinRisk?.violinName || `提琴 ${violinId}`
    
    const note: ReviewNote = {
      violinId,
      notes,
      reviewedBy: '当前用户',
      reviewedAt: nowString(),
      decision
    }
    
    reviewNotes.value[violinId] = note
    
    if (decision === 'block') {
      if (!blockedViolins.value.some(b => b.violinId === violinId)) {
        blockedViolins.value.push({
          violinId,
          violinName,
          reason: notes,
          blockedBy: '当前用户',
          blockedAt: nowString(),
          notes: '人工复核后扣留'
        })
      }
      addAuditLog('扣留乐器', `提琴 ${violinId}(${violinName}) 已扣留，原因: ${notes.substring(0, 50)}`, violinId, violinName)
    } else if (decision === 'maintenance') {
      const existingMaintenance = maintenanceNotes.value.find(
        m => m.violinId === violinId && m.status !== 'completed'
      )
      if (!existingMaintenance) {
        maintenanceNotes.value.push({
          id: `maintenance_${Date.now()}`,
          violinId,
          violinName,
          createDate: todayString(),
          issueType: 'other',
          description: notes,
          status: 'pending',
          notes: '人工复核后新增'
        })
      }
      addAuditLog('标记维修', `提琴 ${violinId}(${violinName}) 标记为待维修，原因: ${notes.substring(0, 50)}`, violinId, violinName)
    } else {
      const blockedIndex = blockedViolins.value.findIndex(b => b.violinId === violinId)
      if (blockedIndex !== -1) {
        blockedViolins.value.splice(blockedIndex, 1)
      }
      addAuditLog('复核通过', `提琴 ${violinId}(${violinName}) 复核通过，可重新上架`, violinId, violinName)
    }
    
    lastUpdated.value = nowString()
  }
  
  function blockViolin(
    violinId: string,
    reason: string
  ) {
    const violinRisk = violinRisks.value.find(r => r.violinId === violinId)
    const violinName = violinRisk?.violinName || `提琴 ${violinId}`
    
    if (!blockedViolins.value.some(b => b.violinId === violinId)) {
      blockedViolins.value.push({
        violinId,
        violinName,
        reason,
        blockedBy: '当前用户',
        blockedAt: nowString()
      })
      addAuditLog('扣留乐器', `提琴 ${violinId}(${violinName}) 已扣留，原因: ${reason.substring(0, 50)}`, violinId, violinName)
    }
    
    lastUpdated.value = nowString()
  }
  
  function unblockViolin(violinId: string) {
    const violinRisk = violinRisks.value.find(r => r.violinId === violinId)
    const violinName = violinRisk?.violinName || `提琴 ${violinId}`
    
    const blockedIndex = blockedViolins.value.findIndex(b => b.violinId === violinId)
    if (blockedIndex !== -1) {
      blockedViolins.value.splice(blockedIndex, 1)
      addAuditLog('解除扣留', `提琴 ${violinId}(${violinName}) 已解除扣留`, violinId, violinName)
    }
    
    lastUpdated.value = nowString()
  }
  
  function getViolinById(violinId: string): ViolinRisk | undefined {
    return violinRisks.value.find(r => r.violinId === violinId)
  }
  
  function getMaintenanceItems(): MaintenanceItem[] {
    const items: MaintenanceItem[] = []
    
    for (const risk of violinRisks.value) {
      if (risk.isBlocked || risk.riskLevel !== 'none') {
        items.push({
          violinId: risk.violinId,
          violinName: risk.violinName,
          issueType: risk.riskTypes.length > 0 ? risk.riskTypes[0].type : 'other',
          description: risk.details.join('；') || '需人工检查',
          riskLevel: risk.riskLevel,
          riskTypes: risk.riskTypes,
          status: risk.isBlocked ? 'pending' : 'pending',
          createdDate: todayString()
        })
      }
    }
    
    for (const maintenance of maintenanceNotes.value) {
      if (maintenance.status !== 'completed') {
        const existingItem = items.find(i => i.violinId === maintenance.violinId)
        if (!existingItem) {
          const risk = violinRisks.value.find(r => r.violinId === maintenance.violinId)
          items.push({
            violinId: maintenance.violinId,
            violinName: maintenance.violinName,
            issueType: maintenance.issueType,
            description: maintenance.description,
            riskLevel: risk?.riskLevel || 'medium',
            riskTypes: risk?.riskTypes || [],
            status: maintenance.status,
            createdDate: maintenance.createDate
          })
        }
      }
    }
    
    return items.sort((a, b) => {
      const priority: Record<string, number> = {
        critical: 5,
        high: 4,
        medium: 3,
        low: 2,
        none: 1
      }
      return priority[b.riskLevel] - priority[a.riskLevel]
    })
  }
  
  function exportMaintenanceMarkdown(): string {
    const items = getMaintenanceItems()
    
    if (items.length === 0) {
      return `# 待维修清单

**生成时间**: ${nowString()}

当前无待维修项目。
`
    }
    
    let markdown = `# 待维修清单

**生成时间**: ${nowString()}
**总计**: ${items.length} 项

---

`
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      markdown += `## ${i + 1}. ${item.violinName} (琴号: ${item.violinId})

- **风险级别**: ${item.riskLevel === 'critical' ? '🔴 严重' : item.riskLevel === 'high' ? '🟠 高风险' : item.riskLevel === 'medium' ? '🟡 中风险' : item.riskLevel === 'low' ? '🟢 低风险' : '⚪ 正常'}
- **问题类型**: ${item.issueType}
- **状态**: ${item.status === 'pending' ? '待处理' : item.status === 'in_progress' ? '处理中' : '已完成'}
- **问题描述**: ${item.description}
- **创建日期**: ${item.createdDate}

`
      
      if (item.riskTypes.length > 0) {
        markdown += `**风险详情**:
`
        for (const rt of item.riskTypes) {
          markdown += `- ${rt.description}\n`
        }
        markdown += '\n'
      }
      
      markdown += '---\n\n'
    }
    
    return markdown
  }
  
  function exportAuditJson(): string {
    return JSON.stringify({
      exportTime: nowString(),
      dataDate: dataDate.value,
      auditLogs: auditLogs.value,
      statistics: statistics.value
    }, null, 2)
  }
  
  function exportAppData(): AppData {
    return {
      rentalRecords: rentalRecords.value,
      humidityRecords: humidityRecords.value,
      bowInspections: bowInspections.value,
      maintenanceNotes: maintenanceNotes.value,
      reviewNotes: reviewNotes.value,
      blockedViolins: blockedViolins.value,
      auditLogs: auditLogs.value,
      lastUpdated: lastUpdated.value,
      dataDate: dataDate.value
    }
  }
  
  function importAppData(data: AppData): boolean {
    try {
      rentalRecords.value = data.rentalRecords || []
      humidityRecords.value = data.humidityRecords || []
      bowInspections.value = data.bowInspections || []
      maintenanceNotes.value = data.maintenanceNotes || []
      reviewNotes.value = data.reviewNotes || {}
      blockedViolins.value = data.blockedViolins || []
      auditLogs.value = data.auditLogs || []
      lastUpdated.value = data.lastUpdated || nowString()
      dataDate.value = data.dataDate || todayString()
      
      addAuditLog('恢复数据', '从存档恢复数据成功')
      return true
    } catch (e) {
      console.error('Failed to import app data:', e)
      return false
    }
  }
  
  function clearAllData() {
    rentalRecords.value = []
    humidityRecords.value = []
    bowInspections.value = []
    maintenanceNotes.value = []
    reviewNotes.value = {}
    blockedViolins.value = []
    lastUpdated.value = nowString()
    dataDate.value = todayString()
    
    addAuditLog('清空数据', '所有数据已清空')
  }

  return {
    rentalRecords,
    humidityRecords,
    bowInspections,
    maintenanceNotes,
    reviewNotes,
    blockedViolins,
    auditLogs,
    lastUpdated,
    dataDate,
    violinRisks,
    criticalRisks,
    highRisks,
    mediumRisks,
    lowRisks,
    noRisks,
    blockedList,
    todayBlocked,
    statistics,
    addAuditLog,
    importRentalRecords,
    importHumidityRecords,
    importBowInspections,
    importMaintenanceNotes,
    addReviewNote,
    blockViolin,
    unblockViolin,
    getViolinById,
    getMaintenanceItems,
    exportMaintenanceMarkdown,
    exportAuditJson,
    exportAppData,
    importAppData,
    clearAllData
  }
})
