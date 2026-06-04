import { ReverberationRecord } from '../models/ReverberationRecord.js'
import { InspectionNote } from '../models/InspectionNote.js'
import { SafetyThreshold } from '../models/SafetyThreshold.js'

export class ReverberationService {
  constructor() {
    this.records = []
    this.notes = []
    this.thresholds = []
    this.importHistory = []
    this.missingTimeRecords = []
    this.conflicts = []
  }

  importRecords(recordDataList) {
    const results = {
      success: [],
      duplicates: [],
      errors: [],
      warnings: []
    }

    for (const data of recordDataList) {
      const checkResult = this.checkDuplicateRecord(data)
      
      if (checkResult.isDuplicate) {
        results.duplicates.push({
          data: data,
          reason: checkResult.reason,
          existingRecord: checkResult.existingRecord
        })
        continue
      }

      const record = new ReverberationRecord(data)
      const validation = this.validateRecord(record)
      
      if (!validation.valid) {
        results.errors.push({
          data: data,
          errors: validation.errors
        })
        continue
      }

      this.records.push(record)
      this.importHistory.push({
        recordId: record.id,
        importTime: record.importTime,
        action: 'import'
      })
      results.success.push(record)

      const warnings = this.checkRecordWarnings(record)
      if (warnings.length > 0) {
        results.warnings.push({
          record: record,
          warnings: warnings
        })
      }
    }

    this.detectMissingTimeGaps()
    return results
  }

  checkDuplicateRecord(data) {
    const existing = this.records.find(r => 
      r.sampleTime === data.sampleTime &&
      r.location === data.location &&
      r.frequency === data.frequency
    )

    if (existing) {
      return {
        isDuplicate: true,
        reason: '同一时间、同一地点、同一频率的记录已存在',
        existingRecord: existing
      }
    }

    return { isDuplicate: false }
  }

  validateRecord(record) {
    const errors = []

    if (!record.sampleTime) {
      errors.push('采样时间不能为空')
    }
    if (record.reverberationTime === null || record.reverberationTime === undefined) {
      errors.push('混响时间值不能为空')
    }
    if (record.reverberationTime < 0) {
      errors.push('混响时间不能为负数')
    }
    if (!record.location) {
      errors.push('测量地点不能为空')
    }

    return {
      valid: errors.length === 0,
      errors: errors
    }
  }

  checkRecordWarnings(record) {
    const warnings = []

    if (!this.checkAgainstThresholds(record)) {
      warnings.push({
        type: 'threshold_violation',
        message: '混响时间超出安全阈值范围',
        details: this.getThresholdViolationDetails(record)
      })
    }

    return warnings
  }

  checkAgainstThresholds(record) {
    const threshold = this.thresholds.find(t => 
      t.frequency === record.frequency && 
      t.location === record.location
    )

    if (!threshold) {
      return true
    }

    return threshold.isWithinRange(record.reverberationTime)
  }

  getThresholdViolationDetails(record) {
    const threshold = this.thresholds.find(t => 
      t.frequency === record.frequency && 
      t.location === record.location
    )

    if (!threshold) {
      return null
    }

    return {
      recordValue: record.reverberationTime,
      min: threshold.minReverberationTime,
      max: threshold.maxReverberationTime
    }
  }

  detectMissingTimeGaps() {
    this.missingTimeRecords = []
    
    const sortedRecords = [...this.records]
      .filter(r => r.sampleTime)
      .sort((a, b) => new Date(a.sampleTime) - new Date(b.sampleTime))

    for (let i = 1; i < sortedRecords.length; i++) {
      const prevTime = new Date(sortedRecords[i - 1].sampleTime)
      const currTime = new Date(sortedRecords[i].sampleTime)
      const diffMinutes = (currTime - prevTime) / (1000 * 60)

      if (diffMinutes > 35 && diffMinutes < 90) {
        const missingRecord = {
          id: 'MISSING_' + Date.now() + '_' + i,
          type: 'time_gap',
          previousRecord: sortedRecords[i - 1],
          nextRecord: sortedRecords[i],
          gapDuration: diffMinutes,
          expectedTime: new Date(prevTime.getTime() + 30 * 60 * 1000).toISOString(),
          status: 'pending_review',
          keepReason: '',
          reviewedBy: '',
          reviewedAt: null
        }
        this.missingTimeRecords.push(missingRecord)
      }
    }

    return this.missingTimeRecords
  }

  getMissingTimeRecords() {
    return this.missingTimeRecords
  }

  reviewMissingRecord(missingId, decision, reason, reviewer) {
    const missing = this.missingTimeRecords.find(m => m.id === missingId)
    
    if (!missing) {
      return { success: false, error: '未找到该缺失记录' }
    }

    missing.status = decision === 'keep' ? 'kept' : 'resolved'
    missing.keepReason = reason
    missing.reviewedBy = reviewer
    missing.reviewedAt = new Date().toISOString()

    if (decision === 'keep') {
      const keepNote = new InspectionNote({
        recordId: missing.previousRecord.id,
        noteContent: `保留${Math.round(missing.gapDuration)}分钟采样间隔，理由：${reason}`,
        author: reviewer,
        isHandwritten: false
      })
      this.notes.push(keepNote)
    }

    return { success: true, record: missing }
  }

  addSupplementRecord(originalRecordId, newData, reason, supplementedBy) {
    const originalRecord = this.records.find(r => r.id === originalRecordId)
    
    if (!originalRecord) {
      return { success: false, error: '未找到原始记录' }
    }

    const supplementRecord = new ReverberationRecord({
      ...newData,
      isSupplement: true,
      supplementReason: reason,
      supplementedBy: supplementedBy,
      originalRecordId: originalRecordId
    })

    this.records.push(supplementRecord)
    this.importHistory.push({
      recordId: supplementRecord.id,
      importTime: supplementRecord.importTime,
      action: 'supplement',
      originalRecordId: originalRecordId
    })

    this.recalculateRelatedRecords(originalRecordId)

    return { success: true, record: supplementRecord }
  }

  recalculateRelatedRecords(originalRecordId) {
    this.detectMissingTimeGaps()
  }

  addInspectionNote(noteData) {
    const note = new InspectionNote(noteData)
    this.notes.push(note)
    
    const conflicts = this.detectNoteThresholdConflicts(note)
    if (conflicts.length > 0) {
      this.conflicts.push(...conflicts)
    }

    return { note, conflicts }
  }

  detectNoteThresholdConflicts(note) {
    const conflicts = []
    const record = this.records.find(r => r.id === note.recordId)
    
    if (!record) return conflicts

    const threshold = this.thresholds.find(t => 
      t.frequency === record.frequency && 
      t.location === record.location
    )

    if (!threshold) return conflicts

    const noteIndicatesNormal = note.noteContent.includes('正常') || 
                                note.noteContent.includes('合格') ||
                                note.noteContent.includes('没问题')
    
    const isWithinThreshold = threshold.isWithinRange(record.reverberationTime)

    if (noteIndicatesNormal && !isWithinThreshold) {
      conflicts.push({
        id: 'CONFLICT_' + Date.now(),
        type: 'note_threshold_conflict',
        noteId: note.id,
        recordId: record.id,
        evidence: {
          noteContent: note.noteContent,
          noteMeaning: '巡检备注标记为正常',
          thresholdRange: `[${threshold.minReverberationTime}, ${threshold.maxReverberationTime}]秒`,
          recordValue: record.reverberationTime + '秒',
          thresholdMeaning: '安全阈值显示超出范围'
        },
        status: 'pending',
        createdAt: new Date().toISOString()
      })
    }

    return conflicts
  }

  getConflicts() {
    return this.conflicts
  }

  resolveConflict(conflictId, decision, resolvedBy) {
    const conflict = this.conflicts.find(c => c.id === conflictId)
    
    if (!conflict) {
      return { success: false, error: '未找到该冲突' }
    }

    conflict.status = decision === 'confirm' ? 'confirmed' : 'rejected'
    conflict.resolvedBy = resolvedBy
    conflict.resolvedAt = new Date().toISOString()

    return { success: true, conflict }
  }

  addSafetyThreshold(thresholdData) {
    const threshold = new SafetyThreshold(thresholdData)
    this.thresholds.push(threshold)
    return threshold
  }

  getSafetyThresholds() {
    return this.thresholds
  }

  runSelfCheck() {
    const results = {
      duplicateCheck: this.checkForDuplicates(),
      missingTimeCheck: this.missingTimeRecords.length > 0 ? {
        hasIssues: true,
        count: this.missingTimeRecords.length,
        details: this.missingTimeRecords.map(m => ({
          gap: Math.round(m.gapDuration) + '分钟',
          between: `${m.previousRecord.sampleTime} 和 ${m.nextRecord.sampleTime}`,
          status: m.status
        }))
      } : { hasIssues: false },
      supplementRecalcCheck: this.checkSupplementRecalculation(),
      exportConsistencyCheck: this.checkExportConsistency(),
      noteThresholdConflicts: this.conflicts.filter(c => c.status === 'pending').length
    }

    return results
  }

  checkForDuplicates() {
    const seen = new Set()
    const duplicates = []

    for (const record of this.records) {
      const key = `${record.sampleTime}_${record.location}_${record.frequency}`
      if (seen.has(key)) {
        duplicates.push(record)
      } else {
        seen.add(key)
      }
    }

    return {
      hasDuplicates: duplicates.length > 0,
      count: duplicates.length,
      duplicates: duplicates
    }
  }

  checkSupplementRecalculation() {
    const supplements = this.records.filter(r => r.isSupplement)
    const issues = []

    for (const supplement of supplements) {
      const original = this.records.find(r => r.id === supplement.originalRecordId)
      if (!original) {
        issues.push({
          supplementId: supplement.id,
          issue: '补录记录找不到对应的原始记录'
        })
      }
    }

    return {
      hasIssues: issues.length > 0,
      count: issues.length,
      issues: issues
    }
  }

  checkExportConsistency() {
    const export1 = this.exportData()
    const export2 = this.exportData()
    
    return {
      consistent: JSON.stringify(export1) === JSON.stringify(export2),
      recordCount: this.records.length
    }
  }

  exportData() {
    return {
      exportTime: new Date().toISOString(),
      records: this.records.map(r => r.toJSON()),
      notes: this.notes.map(n => n.toJSON()),
      thresholds: this.thresholds.map(t => t.toJSON())
    }
  }

  getReviewChartData() {
    const byDate = {}
    
    for (const record of this.records) {
      const date = record.sampleTime ? record.sampleTime.split('T')[0] : '未知'
      if (!byDate[date]) {
        byDate[date] = {
          normal: 0,
          supplement: 0,
          missing: 0,
          conflict: 0
        }
      }
      
      if (record.isSupplement) {
        byDate[date].supplement++
      } else {
        byDate[date].normal++
      }
    }

    for (const missing of this.missingTimeRecords) {
      const date = missing.expectedTime.split('T')[0]
      if (!byDate[date]) {
        byDate[date] = { normal: 0, supplement: 0, missing: 0, conflict: 0 }
      }
      byDate[date].missing++
    }

    return {
      labels: Object.keys(byDate).sort(),
      datasets: [
        {
          label: '正常记录',
          data: Object.keys(byDate).sort().map(d => byDate[d].normal),
          backgroundColor: '#4CAF50'
        },
        {
          label: '补录记录',
          data: Object.keys(byDate).sort().map(d => byDate[d].supplement),
          backgroundColor: '#FF9800'
        },
        {
          label: '时间缺失',
          data: Object.keys(byDate).sort().map(d => byDate[d].missing),
          backgroundColor: '#F44336'
        }
      ]
    }
  }

  getRecords() {
    return this.records
  }

  getNotes() {
    return this.notes
  }

  getImportHistory() {
    return this.importHistory
  }
}
