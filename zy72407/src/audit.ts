import { v4 as uuidv4 } from 'uuid'
import {
  ConsumptionRecord,
  AuditLogEntry,
  RecordStatus,
  ReviewFlag
} from './types'

export function createAuditLog(
  operator: string,
  action: string,
  fieldName?: string,
  oldValue?: string,
  newValue?: string,
  reason?: string
): AuditLogEntry {
  return {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    operator,
    action,
    fieldName,
    oldValue,
    newValue,
    reason
  }
}

export function addManualEdit(
  record: ConsumptionRecord,
  operator: string,
  fieldName: string,
  oldValue: string,
  newValue: string,
  reason?: string
): ConsumptionRecord {
  const auditLog = createAuditLog(
    operator,
    'manual_edit',
    fieldName,
    oldValue,
    newValue,
    reason
  )

  return {
    ...record,
    manualEdits: [...record.manualEdits, auditLog],
    reviewFlag: ReviewFlag.MANUAL_EDIT,
    updatedAt: new Date().toISOString()
  }
}

export function updateRecordStatus(
  record: ConsumptionRecord,
  newStatus: RecordStatus,
  operator: string,
  reason?: string
): ConsumptionRecord {
  const oldStatus = record.status
  
  if (oldStatus === RecordStatus.NEEDS_REVIEW && 
      newStatus === RecordStatus.CONFIRMED &&
      record.reviewFlag === ReviewFlag.TEMP_SUB_ONLY_IN_GROUP) {
    const auditLog = createAuditLog(
      operator,
      'status_change',
      'reviewFlag',
      record.reviewFlag,
      ReviewFlag.NONE,
      reason || '票务同事复核通过'
    )
    
    return {
      ...record,
      status: newStatus,
      reviewFlag: ReviewFlag.NONE,
      manualEdits: [...record.manualEdits, auditLog],
      updatedAt: new Date().toISOString()
    }
  }

  const auditLog = createAuditLog(
    operator,
    'status_change',
    'status',
    oldStatus,
    newStatus,
    reason
  )

  return {
    ...record,
    status: newStatus,
    manualEdits: [...record.manualEdits, auditLog],
    updatedAt: new Date().toISOString()
  }
}

export function confirmTempSubstitute(
  record: ConsumptionRecord,
  operator: string,
  confirm: boolean,
  reason?: string
): ConsumptionRecord {
  if (record.reviewFlag !== ReviewFlag.TEMP_SUB_ONLY_IN_GROUP) {
    return record
  }

  if (confirm) {
    return updateRecordStatus(
      record,
      RecordStatus.CONFIRMED,
      operator,
      reason || '临时替补复核通过'
    )
  } else {
    const auditLog = createAuditLog(
      operator,
      'reject_temp_substitute',
      undefined,
      undefined,
      undefined,
      reason || '临时替补不予确认'
    )

    return {
      ...record,
      status: RecordStatus.ERROR,
      manualEdits: [...record.manualEdits, auditLog],
      updatedAt: new Date().toISOString()
    }
  }
}

export function settleRecords(
  records: ConsumptionRecord[],
  operator: string
): ConsumptionRecord[] {
  const now = new Date().toISOString()
  
  return records.map(record => {
    if (record.status !== RecordStatus.CONFIRMED) {
      return record
    }

    const auditLog = createAuditLog(
      operator,
      'settle',
      'status',
      record.status,
      RecordStatus.SETTLED,
      '分账明细更新'
    )

    return {
      ...record,
      status: RecordStatus.SETTLED,
      settledAt: now,
      manualEdits: [...record.manualEdits, auditLog],
      updatedAt: now
    }
  })
}

export function getRecordAuditTrail(record: ConsumptionRecord): any[] {
  const trail: any[] = []

  trail.push({
    timestamp: record.createdAt,
    action: 'created',
    details: '记录创建'
  })

  if (record.matchedAt) {
    trail.push({
      timestamp: record.matchedAt,
      action: 'matched',
      details: `自动匹配 ${record.matchedBy === 'auto' ? '系统' : '人工'}完成`
    })
  }

  record.manualEdits.forEach(edit => {
    trail.push({
      timestamp: edit.timestamp,
      action: edit.action,
      operator: edit.operator,
      field: edit.fieldName,
      oldValue: edit.oldValue,
      newValue: edit.newValue,
      reason: edit.reason
    })
  })

  if (record.settledAt) {
    trail.push({
      timestamp: record.settledAt,
      action: 'settled',
      details: '分账完成'
    })
  }

  return trail.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )
}
