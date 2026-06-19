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
    this.batches = []
    this.currentBatchId = null
    this.changeLogs = []
    this._batchSeq = 0
    this._changeLogSeq = 0
  }

  createBatch(batchName, operator = 'system') {
    this._batchSeq++
    const batch = {
      id: 'BATCH_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      name: batchName || '导入批次_' + new Date().toLocaleString('zh-CN'),
      operator: operator,
      createdAt: new Date().toISOString(),
      status: 'in_progress',
      recordIds: [],
      noteIds: [],
      supplementIds: [],
      sequenceNumber: this._batchSeq
    }
    this.batches.push(batch)
    this.currentBatchId = batch.id
    return batch
  }

  getCurrentBatch() {
    if (!this.currentBatchId) return null
    return this.batches.find(b => b.id === this.currentBatchId) || null
  }

  finishBatch(batchId) {
    const batch = this.batches.find(b => b.id === batchId)
    if (batch) {
      batch.status = 'completed'
      batch.finishedAt = new Date().toISOString()
    }
    return batch
  }

  getBatches() {
    return [...this.batches].sort((a, b) => b.sequenceNumber - a.sequenceNumber)
  }

  getBatchById(batchId) {
    return this.batches.find(b => b.id === batchId) || null
  }

  addChangeLog(type, entityType, entityId, description, operator, details = {}) {
    this._changeLogSeq++
    const log = {
      id: 'LOG_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      type: type,
      entityType: entityType,
      entityId: entityId,
      description: description,
      operator: operator,
      timestamp: new Date().toISOString(),
      details: details,
      batchId: this.currentBatchId,
      sequenceNumber: this._changeLogSeq
    }
    this.changeLogs.push(log)
    return log
  }

  getChangeLogs(filter = {}) {
    let logs = [...this.changeLogs]
    
    if (filter.entityType) {
      logs = logs.filter(l => l.entityType === filter.entityType)
    }
    if (filter.entityId) {
      logs = logs.filter(l => l.entityId === filter.entityId)
    }
    if (filter.type) {
      logs = logs.filter(l => l.type === filter.type)
    }
    if (filter.batchId) {
      logs = logs.filter(l => l.batchId === filter.batchId)
    }
    
    return logs.sort((a, b) => b.sequenceNumber - a.sequenceNumber)
  }

  importRecords(recordDataList, operator = 'system', batchName = null) {
    const batch = this.createBatch(batchName, operator)
    
    const results = {
      success: [],
      duplicates: [],
      errors: [],
      warnings: [],
      batchId: batch.id
    }

    for (const data of recordDataList) {
      const checkResult = this.checkDuplicateRecord(data)
      
      if (checkResult.isDuplicate) {
        results.duplicates.push({
          data: data,
          reason: checkResult.reason,
          existingRecord: checkResult.existingRecord,
          existingBatchId: checkResult.existingBatchId
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

      record.batchId = batch.id
      this.records.push(record)
      this.importHistory.push({
        recordId: record.id,
        importTime: record.importTime,
        action: 'import',
        batchId: batch.id
      })
      
      batch.recordIds.push(record.id)
      
      this.addChangeLog(
        'create',
        'record',
        record.id,
        `导入新记录：${record.location} ${record.frequency}Hz`,
        operator,
        { sampleTime: record.sampleTime, reverberationTime: record.reverberationTime }
      )
      
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
    this.finishBatch(batch.id)
    
    return results
  }

  checkDuplicateRecord(data) {
    const existing = this.records.find(r => 
      r.sampleTime === data.sampleTime &&
      r.location === data.location &&
      r.frequency === data.frequency &&
      !r.isSupplement
    )

    if (existing) {
      const existingBatch = this.batches.find(b => b.recordIds.includes(existing.id))
      return {
        isDuplicate: true,
        reason: `同一时间、同一地点、同一频率的记录已存在（来自批次：${existingBatch ? existingBatch.name : '未知'}）`,
        existingRecord: existing,
        existingBatchId: existing ? existing.batchId : null
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
    const existingMissingIds = new Set(this.missingTimeRecords.map(m => {
      return `${m.previousRecord?.id}_${m.nextRecord?.id}`
    }))
    
    const newMissingRecords = []
    const processedMissingIds = new Set()
    
    const sortedRecords = [...this.records]
      .filter(r => r.sampleTime)
      .sort((a, b) => new Date(a.sampleTime) - new Date(b.sampleTime))

    for (let i = 1; i < sortedRecords.length; i++) {
      const prevTime = new Date(sortedRecords[i - 1].sampleTime)
      const currTime = new Date(sortedRecords[i].sampleTime)
      const diffMinutes = (currTime - prevTime) / (1000 * 60)

      if (diffMinutes > 35 && diffMinutes < 90) {
        const key = `${sortedRecords[i - 1].id}_${sortedRecords[i].id}`
        
        const existing = this.missingTimeRecords.find(m => 
          m.previousRecord?.id === sortedRecords[i - 1].id && 
          m.nextRecord?.id === sortedRecords[i].id
        )
        
        if (existing) {
          processedMissingIds.add(existing.id)
          newMissingRecords.push(existing)
        } else {
          const missingRecord = {
            id: 'MISSING_' + Date.now() + '_' + i,
            type: 'time_gap',
            previousRecord: sortedRecords[i - 1],
            nextRecord: sortedRecords[i],
            previousRecordId: sortedRecords[i - 1].id,
            nextRecordId: sortedRecords[i].id,
            gapDuration: diffMinutes,
            expectedTime: new Date(prevTime.getTime() + 30 * 60 * 1000).toISOString(),
            status: 'pending_review',
            keepReason: '',
            reviewedBy: '',
            reviewedAt: null,
            resolvedWith: null,
            resolvedAt: null,
            resolvedBy: null,
            supplementRecordId: null,
            detectedAt: new Date().toISOString()
          }
          processedMissingIds.add(missingRecord.id)
          newMissingRecords.push(missingRecord)
          
          this.addChangeLog(
            'detect',
            'missing_time',
            missingRecord.id,
            `检测到 ${Math.round(diffMinutes)} 分钟采样间隔`,
            'system',
            {
              previousTime: sortedRecords[i - 1].sampleTime,
              nextTime: sortedRecords[i].sampleTime,
              gapMinutes: Math.round(diffMinutes)
            }
          )
        }
      }
    }

    for (const oldMissing of this.missingTimeRecords) {
      if (processedMissingIds.has(oldMissing.id)) continue
      if (oldMissing.status === 'pending_review') continue
      newMissingRecords.push(oldMissing)
    }

    this.missingTimeRecords = newMissingRecords
    return this.missingTimeRecords
  }

  getMissingTimeRecords() {
    return this.missingTimeRecords
  }

  getMissingTimeRecordById(missingId) {
    return this.missingTimeRecords.find(m => m.id === missingId) || null
  }

  reviewMissingRecord(missingId, decision, reason, reviewer) {
    const missing = this.missingTimeRecords.find(m => m.id === missingId)
    
    if (!missing) {
      return { success: false, error: '未找到该缺失记录' }
    }

    const oldStatus = missing.status
    missing.status = decision === 'keep' ? 'kept' : 'resolved'
    missing.keepReason = reason
    missing.reviewedBy = reviewer
    missing.reviewedAt = new Date().toISOString()

    if (decision === 'keep') {
      const keepNote = new InspectionNote({
        recordId: missing.previousRecord.id,
        noteContent: `保留${Math.round(missing.gapDuration)}分钟采样间隔，理由：${reason}`,
        author: reviewer,
        isHandwritten: false,
        relatedMissingId: missingId
      })
      this.notes.push(keepNote)
      
      const batch = this.getCurrentBatch()
      if (batch) {
        batch.noteIds.push(keepNote.id)
      }
    }

    this.addChangeLog(
      'update',
      'missing_time',
      missingId,
      `${reviewer} 复核缺失记录：${decision === 'keep' ? '保留' : '解决'}`,
      reviewer,
      {
        oldStatus: oldStatus,
        newStatus: missing.status,
        reason: reason
      }
    )

    return { success: true, record: missing }
  }

  addSupplementRecord(originalRecordId, newData, reason, supplementedBy, relatedMissingId = null) {
    const originalRecord = this.records.find(r => r.id === originalRecordId)
    
    if (!originalRecord) {
      return { success: false, error: '未找到原始记录' }
    }

    const relatedMissing = relatedMissingId 
      ? this.missingTimeRecords.find(m => m.id === relatedMissingId)
      : null

    const supplementRecord = new ReverberationRecord({
      ...newData,
      isSupplement: true,
      supplementReason: reason,
      supplementedBy: supplementedBy,
      originalRecordId: originalRecordId,
      relatedMissingId: relatedMissingId,
      supplementTime: new Date().toISOString()
    })

    const batch = this.getCurrentBatch()
    if (batch) {
      supplementRecord.batchId = batch.id
      batch.recordIds.push(supplementRecord.id)
      batch.supplementIds.push(supplementRecord.id)
    }

    this.records.push(supplementRecord)
    this.importHistory.push({
      recordId: supplementRecord.id,
      importTime: supplementRecord.importTime,
      action: 'supplement',
      originalRecordId: originalRecordId,
      relatedMissingId: relatedMissingId,
      batchId: supplementRecord.batchId
    })

    this.addChangeLog(
      'supplement',
      'record',
      supplementRecord.id,
      `${supplementedBy} 添加补录记录，关联原始记录：${originalRecord.location} ${originalRecord.frequency}Hz`,
      supplementedBy,
      {
        originalRecordId: originalRecordId,
        originalSampleTime: originalRecord.sampleTime,
        reason: reason,
        relatedMissingId: relatedMissingId,
        relatedMissingGap: relatedMissing ? Math.round(relatedMissing.gapDuration) + '分钟' : null,
        sampleTime: supplementRecord.sampleTime,
        reverberationTime: supplementRecord.reverberationTime
      }
    )

    originalRecord.supplementedCount = (originalRecord.supplementedCount || 0) + 1
    originalRecord.lastSupplementedAt = supplementRecord.supplementTime
    originalRecord.supplementStatus = 'supplemented'

    this.addChangeLog(
      'update',
      'record',
      originalRecordId,
      `原始记录关联了新的补录，补录状态：已补录`,
      supplementedBy,
      {
        supplementRecordId: supplementRecord.id,
        supplementedCount: originalRecord.supplementedCount,
        relatedMissingId: relatedMissingId
      }
    )

    let missingResolution = null
    if (relatedMissing && relatedMissing.status === 'pending_review') {
      relatedMissing.status = 'resolved'
      relatedMissing.resolvedWith = 'supplement'
      relatedMissing.resolvedAt = supplementRecord.supplementTime
      relatedMissing.resolvedBy = supplementedBy
      relatedMissing.supplementRecordId = supplementRecord.id
      relatedMissing.supplementReason = reason

      this.addChangeLog(
        'review',
        'missing_time',
        relatedMissingId,
        `${supplementedBy} 通过补录解决了 ${Math.round(relatedMissing.gapDuration)} 分钟缺失间隔`,
        supplementedBy,
        {
          decision: 'supplement',
          gapDuration: Math.round(relatedMissing.gapDuration),
          supplementRecordId: supplementRecord.id,
          expectedTime: relatedMissing.expectedTime,
          actualSampleTime: supplementRecord.sampleTime,
          reason: reason
        }
      )

      missingResolution = {
        missingId: relatedMissingId,
        gapDuration: relatedMissing.gapDuration,
        beforeStatus: 'pending_review',
        afterStatus: 'resolved'
      }
    }

    const recalcResults = this.recalculateRelatedRecords(originalRecordId, supplementRecord.id, supplementedBy)

    return { 
      success: true, 
      record: supplementRecord,
      originalRecordUpdate: {
        id: originalRecordId,
        supplementStatus: originalRecord.supplementStatus,
        supplementedCount: originalRecord.supplementedCount
      },
      missingResolution: missingResolution,
      recalcResults: recalcResults
    }
  }

  recalculateRelatedRecords(originalRecordId, supplementRecordId = null, operator = 'system') {
    const beforeMissingCount = this.missingTimeRecords.length
    const beforeMissingIds = new Set(this.missingTimeRecords.map(m => m.id))
    
    this.detectMissingTimeGaps()
    
    const afterMissingIds = new Set(this.missingTimeRecords.map(m => m.id))
    
    const resolved = [...beforeMissingIds].filter(id => !afterMissingIds.has(id))
    const added = [...afterMissingIds].filter(id => !beforeMissingIds.has(id))

    for (const resolvedId of resolved) {
      this.addChangeLog(
        'update',
        'missing_time',
        resolvedId,
        `补录后重算：缺失间隔被消除`,
        operator,
        {
          cause: 'supplement_recalculation',
          supplementRecordId: supplementRecordId,
          originalRecordId: originalRecordId
        }
      )
    }

    for (const addedId of added) {
      const addedMissing = this.missingTimeRecords.find(m => m.id === addedId)
      this.addChangeLog(
        'detect',
        'missing_time',
        addedId,
        `补录后重算：检测到新的 ${addedMissing ? Math.round(addedMissing.gapDuration) : 0} 分钟缺失间隔`,
        operator,
        {
          cause: 'supplement_recalculation',
          supplementRecordId: supplementRecordId,
          originalRecordId: originalRecordId,
          gapDuration: addedMissing ? Math.round(addedMissing.gapDuration) : 0
        }
      )
    }

    if (supplementRecordId) {
      this.addChangeLog(
        'update',
        'record',
        supplementRecordId,
        `补录后重算完成：消除 ${resolved.length} 个旧缺失，新增 ${added.length} 个缺失`,
        operator,
        {
          cause: 'supplement_recalculation',
          resolvedMissingCount: resolved.length,
          addedMissingCount: added.length,
          resolvedMissingIds: resolved,
          addedMissingIds: added,
          originalRecordId: originalRecordId
        }
      )
    }
    
    return {
      beforeCount: beforeMissingCount,
      afterCount: this.missingTimeRecords.length,
      resolvedMissingIds: resolved,
      addedMissingIds: added,
      supplementRecordId: supplementRecordId,
      originalRecordId: originalRecordId
    }
  }

  addInspectionNote(noteData) {
    const note = new InspectionNote(noteData)
    
    const batch = this.getCurrentBatch()
    if (batch) {
      note.batchId = batch.id
      batch.noteIds.push(note.id)
    }
    
    this.notes.push(note)
    
    this.addChangeLog(
      'create',
      'note',
      note.id,
      `添加巡检备注：${note.noteContent.substring(0, 30)}${note.noteContent.length > 30 ? '...' : ''}`,
      note.author || 'system',
      {
        recordId: note.recordId,
        isHandwritten: note.isHandwritten,
        content: note.noteContent
      }
    )
    
    const conflicts = this.detectNoteThresholdConflicts(note)
    if (conflicts.length > 0) {
      this.conflicts.push(...conflicts)
      
      conflicts.forEach(c => {
        this.addChangeLog(
          'detect',
          'conflict',
          c.id,
          '检测到巡检备注与安全阈值冲突',
          'system',
          {
            noteId: note.id,
            recordId: note.recordId,
            evidence: c.evidence
          }
        )
      })
    }

    return { note, conflicts }
  }

  updateInspectionNote(noteId, newContent, updater) {
    const note = this.notes.find(n => n.id === noteId)
    
    if (!note) {
      return { success: false, error: '未找到该备注' }
    }

    const oldContent = note.noteContent
    note.noteContent = newContent
    note.updatedAt = new Date().toISOString()
    note.updatedBy = updater

    this.addChangeLog(
      'update',
      'note',
      noteId,
      '修改巡检备注',
      updater,
      {
        oldContent: oldContent,
        newContent: newContent,
        recordId: note.recordId
      }
    )

    const newConflicts = this.detectNoteThresholdConflicts(note)
    
    const existingConflictIndex = this.conflicts.findIndex(c => c.noteId === noteId)
    if (existingConflictIndex >= 0) {
      this.conflicts.splice(existingConflictIndex, 1)
    }
    
    if (newConflicts.length > 0) {
      this.conflicts.push(...newConflicts)
    }

    return { success: true, note, newConflicts }
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
        id: 'CONFLICT_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
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
        createdAt: new Date().toISOString(),
        batchId: this.currentBatchId
      })
    }

    return conflicts
  }

  getConflicts() {
    return this.conflicts
  }

  getConflictById(conflictId) {
    return this.conflicts.find(c => c.id === conflictId) || null
  }

  resolveConflict(conflictId, decision, resolvedBy) {
    const conflict = this.conflicts.find(c => c.id === conflictId)
    
    if (!conflict) {
      return { success: false, error: '未找到该冲突' }
    }

    const oldStatus = conflict.status
    conflict.status = decision === 'confirm' ? 'confirmed' : 'rejected'
    conflict.resolvedBy = resolvedBy
    conflict.resolvedAt = new Date().toISOString()

    this.addChangeLog(
      'update',
      'conflict',
      conflictId,
      `${resolvedBy} 处理冲突：${decision === 'confirm' ? '确认冲突' : '驳回冲突'}`,
      resolvedBy,
      {
        oldStatus: oldStatus,
        newStatus: conflict.status,
        recordId: conflict.recordId
      }
    )

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
        pendingCount: this.missingTimeRecords.filter(m => m.status === 'pending_review').length,
        details: this.missingTimeRecords.map(m => ({
          id: m.id,
          gap: Math.round(m.gapDuration) + '分钟',
          between: `${m.previousRecord.sampleTime} 和 ${m.nextRecord.sampleTime}`,
          status: m.status,
          keepReason: m.keepReason,
          reviewedBy: m.reviewedBy
        }))
      } : { hasIssues: false, count: 0, pendingCount: 0 },
      supplementRecalcCheck: this.checkSupplementRecalculation(),
      exportConsistencyCheck: this.checkExportConsistency(),
      noteThresholdConflicts: this.conflicts.filter(c => c.status === 'pending').length,
      batchConsistencyCheck: this.checkBatchConsistency()
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
    const warnings = []

    const pendingMissing = this.missingTimeRecords.filter(m => m.status === 'pending_review')
    const keptMissing = this.missingTimeRecords.filter(m => m.status === 'kept')
    const resolvedMissing = this.missingTimeRecords.filter(m => m.status === 'resolved')

    if (supplements.length === 0) {
      if (pendingMissing.length > 0) {
        warnings.push({
          type: 'no_supplement_with_pending',
          message: `存在 ${pendingMissing.length} 个待处理缺失，尚未产生任何补录记录`
        })
      }
    }

    for (const supplement of supplements) {
      const original = this.records.find(r => r.id === supplement.originalRecordId)
      if (!original) {
        issues.push({
          supplementId: supplement.id,
          sampleTime: supplement.sampleTime,
          issue: '补录记录找不到对应的原始记录',
          severity: 'error'
        })
        continue
      }

      if (!supplement.supplementedBy) {
        issues.push({
          supplementId: supplement.id,
          sampleTime: supplement.sampleTime,
          issue: '补录记录缺少补录人信息',
          severity: 'error'
        })
      }

      if (!supplement.supplementReason) {
        warnings.push({
          supplementId: supplement.id,
          sampleTime: supplement.sampleTime,
          issue: '补录记录未填写补录原因',
          severity: 'warning'
        })
      }

      if (supplement.relatedMissingId) {
        const relatedMissing = this.missingTimeRecords.find(m => m.id === supplement.relatedMissingId)
        if (!relatedMissing) {
          warnings.push({
            supplementId: supplement.id,
            sampleTime: supplement.sampleTime,
            issue: '补录记录关联的缺失间隔已不存在（可能被重算消除）',
            severity: 'warning'
          })
        } else if (relatedMissing.supplementRecordId !== supplement.id) {
          issues.push({
            supplementId: supplement.id,
            sampleTime: supplement.sampleTime,
            issue: '补录关联的缺失间隔没有反向绑定补录记录，关联链断裂',
            severity: 'error'
          })
        }
      }

      if (original.supplementStatus !== 'supplemented') {
        warnings.push({
          supplementId: supplement.id,
          sampleTime: supplement.sampleTime,
          issue: '原始记录补录状态未同步更新',
          severity: 'warning'
        })
      }
    }

    for (const resolved of resolvedMissing) {
      if (resolved.resolvedWith === 'supplement') {
        const relatedSupplement = supplements.find(s => s.id === resolved.supplementRecordId)
        if (!relatedSupplement) {
          issues.push({
            missingId: resolved.id,
            issue: `缺失间隔标注为补录解决，但找不到对应补录记录（${resolved.supplementRecordId || '无ID'}）`,
            severity: 'error'
          })
        }
      }
    }

    return {
      hasIssues: issues.length > 0,
      count: issues.length,
      issues: issues,
      warnings: warnings,
      warningCount: warnings.length,
      supplementCount: supplements.length,
      pendingMissingCount: pendingMissing.length,
      keptMissingCount: keptMissing.length,
      resolvedMissingCount: resolvedMissing.length,
      status: supplements.length === 0 
        ? (pendingMissing.length > 0 ? 'pending_missing' : 'no_data')
        : (issues.length > 0 ? 'has_issues' : (warnings.length > 0 ? 'has_warnings' : 'normal'))
    }
  }

  checkExportConsistency() {
    const data1 = this.getDataSnapshot()
    const data2 = this.getDataSnapshot()
    
    const consistent = JSON.stringify(data1) === JSON.stringify(data2)
    
    return {
      consistent: consistent,
      recordCount: this.records.length,
      noteCount: this.notes.length,
      thresholdCount: this.thresholds.length
    }
  }

  checkBatchConsistency() {
    const issues = []
    
    for (const batch of this.batches) {
      for (const recordId of batch.recordIds) {
        const record = this.records.find(r => r.id === recordId)
        if (!record) {
          issues.push({
            batchId: batch.id,
            batchName: batch.name,
            issue: `批次中的记录 ${recordId} 不存在`
          })
        }
      }
    }
    
    return {
      hasIssues: issues.length > 0,
      count: issues.length,
      issues: issues,
      batchCount: this.batches.length
    }
  }

  getDataSnapshot() {
    return {
      records: this.records.map(r => {
        const json = r.toJSON()
        delete json.importTime
        return json
      }).sort((a, b) => a.id.localeCompare(b.id)),
      notes: this.notes.map(n => {
        const json = n.toJSON()
        delete json.createTime
        return json
      }).sort((a, b) => a.id.localeCompare(b.id)),
      thresholds: this.thresholds.map(t => {
        const json = t.toJSON()
        delete json.updateTime
        return json
      }).sort((a, b) => a.id.localeCompare(b.id))
    }
  }

  exportData(includeMetadata = true) {
    const data = {
      records: this.records.map(r => r.toJSON()),
      notes: this.notes.map(n => n.toJSON()),
      thresholds: this.thresholds.map(t => t.toJSON())
    }
    
    if (includeMetadata) {
      data.exportTime = new Date().toISOString()
      data.exportVersion = '1.0.0'
      data.batches = this.batches.map(b => ({
        id: b.id,
        name: b.name,
        operator: b.operator,
        createdAt: b.createdAt,
        status: b.status,
        recordCount: b.recordIds.length,
        noteCount: b.noteIds.length
      }))
    }
    
    return data
  }

  importData(data, operator = 'system') {
    if (!data.records) {
      return { success: false, error: '导入数据格式不正确' }
    }
    
    const batch = this.createBatch('数据导入_' + new Date().toLocaleString('zh-CN'), operator)
    
    let recordCount = 0
    let noteCount = 0
    
    for (const recordData of data.records) {
      const record = new ReverberationRecord(recordData)
      record.batchId = batch.id
      this.records.push(record)
      batch.recordIds.push(record.id)
      recordCount++
    }
    
    if (data.notes) {
      for (const noteData of data.notes) {
        const note = new InspectionNote(noteData)
        note.batchId = batch.id
        this.notes.push(note)
        batch.noteIds.push(note.id)
        noteCount++
      }
    }
    
    if (data.thresholds) {
      for (const thresholdData of data.thresholds) {
        this.addSafetyThreshold(thresholdData)
      }
    }
    
    this.finishBatch(batch.id)
    this.detectMissingTimeGaps()
    
    return {
      success: true,
      batchId: batch.id,
      recordCount,
      noteCount
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
          conflict: 0,
          pendingMissing: 0
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
        byDate[date] = { normal: 0, supplement: 0, missing: 0, conflict: 0, pendingMissing: 0 }
      }
      byDate[date].missing++
      if (missing.status === 'pending_review') {
        byDate[date].pendingMissing++
      }
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
          label: '时间缺失（待复核）',
          data: Object.keys(byDate).sort().map(d => byDate[d].pendingMissing),
          backgroundColor: '#F44336'
        },
        {
          label: '时间缺失（已处理）',
          data: Object.keys(byDate).sort().map(d => byDate[d].missing - byDate[d].pendingMissing),
          backgroundColor: '#9C27B0'
        }
      ]
    }
  }

  getRecords(filter = {}) {
    let records = [...this.records]
    
    if (filter.location) {
      records = records.filter(r => r.location === filter.location)
    }
    if (filter.isSupplement !== undefined) {
      records = records.filter(r => r.isSupplement === filter.isSupplement)
    }
    if (filter.batchId) {
      records = records.filter(r => r.batchId === filter.batchId)
    }
    
    return records.sort((a, b) => new Date(b.sampleTime) - new Date(a.sampleTime))
  }

  getRecordById(recordId) {
    return this.records.find(r => r.id === recordId) || null
  }

  getNotes(filter = {}) {
    let notes = [...this.notes]
    
    if (filter.recordId) {
      notes = notes.filter(n => n.recordId === filter.recordId)
    }
    if (filter.batchId) {
      notes = notes.filter(n => n.batchId === filter.batchId)
    }
    if (filter.isHandwritten !== undefined) {
      notes = notes.filter(n => n.isHandwritten === filter.isHandwritten)
    }
    
    return notes.sort((a, b) => new Date(b.createTime) - new Date(a.createTime))
  }

  getImportHistory() {
    return [...this.importHistory].reverse()
  }

  getRecordDetail(recordId) {
    const record = this.getRecordById(recordId)
    if (!record) return null
    
    const notes = this.getNotes({ recordId })
    const changeLogs = this.getChangeLogs({ entityType: 'record', entityId: recordId })
    
    let supplements = []
    let originalRecord = null
    let resolvedMissingForSupplement = null
    
    if (record.isSupplement) {
      originalRecord = this.getRecordById(record.originalRecordId)
      if (record.relatedMissingId) {
        resolvedMissingForSupplement = this.getMissingTimeRecordById(record.relatedMissingId)
      }
    } else {
      supplements = this.records.filter(r => r.originalRecordId === recordId)
    }
    
    const relatedMissing = this.missingTimeRecords.filter(m => 
      m.previousRecord?.id === recordId || 
      m.nextRecord?.id === recordId ||
      m.previousRecordId === recordId ||
      m.nextRecordId === recordId ||
      m.supplementRecordId === recordId
    )
    
    const relatedConflicts = this.conflicts.filter(c => c.recordId === recordId)
    
    const supplementSummary = {
      isSupplement: !!record.isSupplement,
      supplementReason: record.supplementReason || null,
      supplementedBy: record.supplementedBy || null,
      supplementTime: record.supplementTime || null,
      relatedMissingId: record.relatedMissingId || null,
      relatedMissingGap: resolvedMissingForSupplement ? Math.round(resolvedMissingForSupplement.gapDuration) + '分钟' : null,
      expectedTime: resolvedMissingForSupplement ? resolvedMissingForSupplement.expectedTime : null,
      originalRecord: originalRecord ? {
        id: originalRecord.id,
        sampleTime: originalRecord.sampleTime,
        location: originalRecord.location,
        frequency: originalRecord.frequency,
        reverberationTime: originalRecord.reverberationTime
      } : null
    }

    const originalRecordSummary = !record.isSupplement ? {
      supplementStatus: record.supplementStatus || 'not_supplemented',
      supplementedCount: record.supplementedCount || 0,
      lastSupplementedAt: record.lastSupplementedAt || null,
      supplements: supplements.map(s => ({
        id: s.id,
        sampleTime: s.sampleTime,
        reverberationTime: s.reverberationTime,
        isSupplement: true,
        supplementReason: s.supplementReason,
        supplementedBy: s.supplementedBy,
        supplementTime: s.supplementTime,
        relatedMissingId: s.relatedMissingId
      }))
    } : null
    
    return {
      record,
      notes,
      changeLogs,
      supplements,
      originalRecord,
      relatedMissing,
      relatedConflicts,
      supplementSummary,
      originalRecordSummary,
      resolvedMissingForSupplement
    }
  }
}
