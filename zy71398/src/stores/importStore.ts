import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  CsvFile,
  CsvRecord,
  ImportSession,
  Conflict,
  RollbackPoint,
  RollbackScope,
  FieldMapping,
  ChangeLog,
  DrillReport
} from '../types'
import { generateId, generateVersionNo, calculateFileHash, parseCsv, detectConflicts, validateRollbackScope, generateRecommendations } from '../utils'

const mockExistingRecords: CsvRecord[] = [
  {
    recordId: 'existing_1',
    fileId: 'old_file_1',
    originalLineNo: 5,
    rawData: { id: 'EMP003', name: '张三', email: 'zhangsan@example.com', department: '技术部' },
    primaryKeyValue: 'EMP003',
    changeLogs: []
  },
  {
    recordId: 'existing_2',
    fileId: 'old_file_1',
    originalLineNo: 8,
    rawData: { id: 'EMP007', name: '李四', email: 'lisi@example.com', department: '市场部' },
    primaryKeyValue: 'EMP007',
    changeLogs: []
  }
]

export const useImportStore = defineStore('import', () => {
  const csvFiles = ref<CsvFile[]>([])
  const importSessions = ref<ImportSession[]>([])
  const conflicts = ref<Conflict[]>([])
  const rollbackPoints = ref<RollbackPoint[]>([])
  const changeLogs = ref<ChangeLog[]>([])
  const reports = ref<DrillReport[]>([])
  
  const currentFileId = ref<string | null>(null)
  const currentSessionId = ref<string | null>(null)
  const selectedConflictId = ref<string | null>(null)
  
  const currentFile = computed(() => 
    csvFiles.value.find(f => f.fileId === currentFileId.value) || null
  )
  
  const currentSession = computed(() => 
    importSessions.value.find(s => s.sessionId === currentSessionId.value) || null
  )
  
  const selectedConflict = computed(() => 
    conflicts.value.find(c => c.conflictId === selectedConflictId.value) || null
  )
  
  const conflictStats = computed(() => {
    const breakdown: Record<string, number> = {
      duplicate_primary_key: 0,
      partial_success: 0,
      rollback_scope_error: 0,
      field_validation: 0,
      data_type_mismatch: 0
    }
    
    conflicts.value.forEach(c => {
      breakdown[c.conflictType]++
    })
    
    return {
      total: conflicts.value.length,
      breakdown,
      bySeverity: {
        high: conflicts.value.filter(c => c.severity === 'high').length,
        medium: conflicts.value.filter(c => c.severity === 'medium').length,
        low: conflicts.value.filter(c => c.severity === 'low').length
      },
      byStatus: {
        open: conflicts.value.filter(c => c.status === 'open').length,
        resolved: conflicts.value.filter(c => c.status === 'resolved').length,
        ignored: conflicts.value.filter(c => c.status === 'ignored').length
      }
    }
  })
  
  const successRate = computed(() => {
    const session = currentSession.value
    if (!session) return 0
    const total = session.successCount + session.conflictCount
    if (total === 0) return 100
    return Math.round((session.successCount / total) * 100)
  })
  
  async function uploadCsvFile(file: File): Promise<CsvFile> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          const { headers, data } = parseCsv(content)
          const fileHash = calculateFileHash(content)
          
          const existingFile = csvFiles.value.find(f => f.fileHash === fileHash)
          if (existingFile) {
            throw new Error(`该文件已存在，版本号: ${existingFile.versionNo}`)
          }
          
          const existingVersions = csvFiles.value.map(f => f.versionNo)
          const versionNo = generateVersionNo(existingVersions)
          
          const records: CsvRecord[] = data.map((row, index) => ({
            recordId: generateId(),
            fileId: '',
            originalLineNo: index + 2,
            rawData: row,
            primaryKeyValue: '',
            changeLogs: []
          }))
          
          const csvFile: CsvFile = {
            fileId: generateId(),
            fileName: file.name,
            versionNo,
            totalRows: data.length,
            uploadedAt: new Date(),
            uploadedBy: '当前用户',
            fileHash,
            headers,
            records
          }
          
          records.forEach(r => r.fileId = csvFile.fileId)
          
          csvFiles.value.push(csvFile)
          currentFileId.value = csvFile.fileId
          
          resolve(csvFile)
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = () => reject(new Error('文件读取失败'))
      reader.readAsText(file, 'UTF-8')
    })
  }
  
  function createImportSession(
    fileId: string,
    fieldMapping: FieldMapping[],
    primaryKeyField: string
  ): ImportSession {
    const file = csvFiles.value.find(f => f.fileId === fileId)
    if (!file) throw new Error('文件不存在')
    
    const session: ImportSession = {
      sessionId: generateId(),
      fileId,
      sessionName: `${file.fileName} - 预演导入`,
      status: 'pending',
      startedAt: new Date(),
      successCount: 0,
      conflictCount: 0,
      fieldMapping,
      primaryKeyField,
      conflicts: [],
      processedRecords: []
    }
    
    importSessions.value.push(session)
    currentSessionId.value = session.sessionId
    
    return session
  }
  
  async function runImportPreview(sessionId: string): Promise<void> {
    const session = importSessions.value.find(s => s.sessionId === sessionId)
    const file = csvFiles.value.find(f => f.fileId === session?.fileId)
    
    if (!session || !file) throw new Error('会话或文件不存在')
    
    session.status = 'running'
    session.conflicts = []
    
    const records = file.records.map(r => ({
      ...r,
      primaryKeyValue: String(r.rawData[session.primaryKeyField] || '')
    }))
    
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    const detectedConflicts = detectConflicts(records, session.primaryKeyField, mockExistingRecords)
    
    detectedConflicts.forEach(c => {
      c.sessionId = sessionId
    })
    
    const successCount = records.length - detectedConflicts.filter(
      c => c.conflictType === 'duplicate_primary_key' || c.conflictType === 'field_validation'
    ).length
    
    conflicts.value.push(...detectedConflicts)
    session.conflicts = detectedConflicts
    session.successCount = Math.max(0, successCount)
    session.conflictCount = detectedConflicts.length
    session.processedRecords = records.map(r => r.recordId)
    session.status = 'completed'
    session.finishedAt = new Date()
    
    file.records = records
  }
  
  function createRollbackPoint(sessionId: string, description: string): RollbackPoint {
    const session = importSessions.value.find(s => s.sessionId === sessionId)
    if (!session) throw new Error('会话不存在')
    
    const existingPoints = rollbackPoints.value.filter(r => r.sessionId === sessionId)
    const versionTag = `RP-${String(existingPoints.length + 1).padStart(3, '0')}`
    
    const allRecordIds = session.processedRecords
    const scope: RollbackScope = {
      scopeId: generateId(),
      rollbackId: '',
      scopeType: 'full',
      affectedRecords: allRecordIds,
      affectedCount: allRecordIds.length,
      riskLevel: allRecordIds.length > 100 ? 'high' : allRecordIds.length > 50 ? 'medium' : 'low',
      validationErrors: []
    }
    
    const rollbackPoint: RollbackPoint = {
      rollbackId: generateId(),
      sessionId,
      versionTag,
      createdAt: new Date(),
      createdBy: '当前用户',
      snapshotData: {
        sessionData: session,
        conflicts: [...conflicts.value]
      },
      description,
      scopes: [scope],
      isExecuted: false
    }
    
    scope.rollbackId = rollbackPoint.rollbackId
    
    rollbackPoints.value.push(rollbackPoint)
    
    return rollbackPoint
  }
  
  function simulateRollback(rollbackId: string): { valid: boolean; errors: string[]; impact: string } {
    const point = rollbackPoints.value.find(r => r.rollbackId === rollbackId)
    if (!point) throw new Error('回滚点不存在')
    
    const scope = point.scopes[0]
    const session = importSessions.value.find(s => s.sessionId === point.sessionId)
    if (!session) throw new Error('会话不存在')
    
    const validation = validateRollbackScope(
      scope.scopeType,
      scope.affectedRecords,
      session.processedRecords
    )
    
    let impact = ''
    if (validation.valid) {
      const affectedPercent = Math.round((scope.affectedCount / session.processedRecords.length) * 100)
      impact = `将影响 ${scope.affectedCount} 条记录 (${affectedPercent}%)`
    }
    
    return {
      valid: validation.valid,
      errors: validation.errors,
      impact
    }
  }
  
  function resolveConflict(conflictId: string, resolution: string): void {
    const conflict = conflicts.value.find(c => c.conflictId === conflictId)
    if (!conflict) throw new Error('冲突不存在')
    
    conflict.status = 'resolved'
    conflict.resolvedAt = new Date()
    conflict.resolvedBy = '当前用户'
    conflict.resolution = resolution
    
    const log: ChangeLog = {
      logId: generateId(),
      recordId: conflict.recordId,
      actionType: 'update',
      changedAt: new Date(),
      changedBy: '当前用户',
      sourceSession: conflict.sessionId,
      oldValue: conflict.status,
      newValue: 'resolved'
    }
    
    changeLogs.value.push(log)
  }
  
  function generateReport(sessionId: string): DrillReport {
    const session = importSessions.value.find(s => s.sessionId === sessionId)
    if (!session) throw new Error('会话不存在')
    
    const total = session.successCount + session.conflictCount
    const rate = total > 0 ? session.successCount / total : 1
    
    const breakdown: Record<string, number> = {
      duplicate_primary_key: 0,
      partial_success: 0,
      rollback_scope_error: 0,
      field_validation: 0,
      data_type_mismatch: 0
    }
    
    session.conflicts.forEach(c => {
      breakdown[c.conflictType]++
    })
    
    const report: DrillReport = {
      reportId: generateId(),
      sessionId,
      generatedAt: new Date(),
      exportFormat: 'json',
      statistics: {
        totalRecords: total,
        successRate: rate,
        conflictBreakdown: breakdown,
        rollbackImpact: {
          affectedRecords: rollbackPoints.value.filter(r => r.sessionId === sessionId).reduce((sum, r) => sum + r.scopes.reduce((s, sc) => s + sc.affectedCount, 0), 0),
          dataLossRisk: rollbackPoints.value.some(r => r.scopes.some(s => s.riskLevel === 'high')) ? 0.7 : 0.3
        },
        recommendations: generateRecommendations(session.conflictCount, rate)
      }
    }
    
    reports.value.push(report)
    
    return report
  }
  
  function getRecordHistory(recordId: string): ChangeLog[] {
    return changeLogs.value.filter(log => log.recordId === recordId).sort(
      (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
    )
  }
  
  return {
    csvFiles,
    importSessions,
    conflicts,
    rollbackPoints,
    changeLogs,
    reports,
    currentFileId,
    currentSessionId,
    selectedConflictId,
    currentFile,
    currentSession,
    selectedConflict,
    conflictStats,
    successRate,
    uploadCsvFile,
    createImportSession,
    runImportPreview,
    createRollbackPoint,
    simulateRollback,
    resolveConflict,
    generateReport,
    getRecordHistory
  }
})
