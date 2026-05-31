import db from './db.js'
import * as repo from './repository.js'
import type { QueueRecord, RecordDetail, CreateRecordRequest, UpdateStatusRequest, StatusType } from '../shared/types.js'

const VALID_TRANSITIONS: Record<StatusType, StatusType[]> = {
  '待草表': ['待确认'],
  '待确认': ['已完成', '已驳回'],
  '已驳回': ['待草表'],
  '已完成': [],
}

export function createRecordWithCheck(req: CreateRecordRequest): {
  record: QueueRecord
  isDuplicate: boolean
  relatedExistingId?: string
} {
  const existingRecords = repo.findExistingRecords(req.activityId, req.source)
  const isDuplicate = existingRecords.length > 0
  const relatedExistingId = isDuplicate ? existingRecords[0].id : undefined

  const transaction = db.transaction(() => {
    const record = repo.createRecord({
      activityId: req.activityId,
      source: req.source,
      submittedBy: req.submittedBy,
      content: req.content,
      isDuplicate,
      relatedRecordId: relatedExistingId,
    })

    const sourceLabel = req.source === '活动复盘' ? '活动复盘' : '关卡草表'
    let createDetail = `创建${sourceLabel}记录，活动ID: ${req.activityId}`
    if (isDuplicate) {
      createDetail += `，检测到重复提交，关联已有记录 ${relatedExistingId}`
    }
    repo.insertAuditLog(record.id, '创建', req.submittedBy, createDetail)

    if (isDuplicate) {
      repo.insertAuditLog(
        record.id,
        '重复标记',
        '系统',
        `活动ID ${req.activityId} 已存在记录 ${relatedExistingId}，本次提交标记为重复`,
      )
    }

    if (req.source === '关卡草表') {
      const pendingDrafts = repo.findPendingDraftRecords(req.activityId)
      for (const draft of pendingDrafts) {
        if (draft.id !== record.id) {
          repo.updateRecordStatus(draft.id, '待草表', '待确认', '系统', `关联关卡草表已提交: ${record.id}`)
          repo.insertStatusChange(draft.id, '待草表', '待确认', '系统', `关联关卡草表已提交: ${record.id}`)
          repo.insertAuditLog(draft.id, '状态变更', '系统', `状态从 待草表 变更为 待确认，原因: 关联关卡草表已提交`)
          repo.insertAuditLog(draft.id, '关联', '系统', `关联关卡草表记录 ${record.id}`)
        }
      }
    }

    return record
  })

  const record = transaction()

  return {
    record,
    isDuplicate,
    relatedExistingId,
  }
}

export function updateStatus(id: string, req: UpdateStatusRequest): RecordDetail {
  const existing = repo.getRecordById(id)
  if (!existing) {
    throw new Error('记录不存在')
  }

  const allowedTransitions = VALID_TRANSITIONS[existing.status]
  if (!allowedTransitions.includes(req.toStatus)) {
    throw new Error(`不允许从 ${existing.status} 变更为 ${req.toStatus}`)
  }

  const transaction = db.transaction(() => {
    const updated = repo.updateRecordStatus(id, existing.status, req.toStatus, req.changedBy, req.reason)
    if (!updated) {
      throw new Error('状态更新失败，记录可能已被修改')
    }

    repo.insertStatusChange(id, existing.status, req.toStatus, req.changedBy, req.reason)

    let action: string
    if (req.toStatus === '已完成') {
      action = '人工确认'
    } else if (req.toStatus === '已驳回') {
      action = '驳回'
    } else {
      action = '状态变更'
    }

    repo.insertAuditLog(
      id,
      action as '人工确认' | '驳回' | '状态变更',
      req.changedBy,
      `状态从 ${existing.status} 变更为 ${req.toStatus}，原因: ${req.reason}`,
    )

    return repo.getRecordById(id)!
  })

  return transaction()
}

export function getAllRecords(filters?: { source?: string; status?: string; search?: string }): QueueRecord[] {
  return repo.getAllRecords(filters)
}

export function getRecordDetail(id: string): RecordDetail | null {
  return repo.getRecordById(id)
}

export function getAuditLogs(filters?: { operator?: string; recordId?: string }) {
  return repo.getAuditLogs(filters)
}
