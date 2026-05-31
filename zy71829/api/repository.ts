import db, { generateId } from './db.js'
import type { QueueRecord, RecordDetail, StatusChange, AuditLog, ActionType } from '../shared/types.js'

function rowToRecord(row: Record<string, unknown>): QueueRecord {
  return {
    id: row.id as string,
    activityId: row.activity_id as string,
    source: row.source as QueueRecord['source'],
    status: row.status as QueueRecord['status'],
    submittedBy: row.submitted_by as string,
    submittedAt: row.submitted_at as string,
    content: row.content as string,
    isDuplicate: Boolean(row.is_duplicate),
    isAnomaly: Boolean(row.is_anomaly),
    anomalyReason: (row.anomaly_reason as string) || undefined,
    relatedRecordId: (row.related_record_id as string) || undefined,
  }
}

function rowToStatusChange(row: Record<string, unknown>): StatusChange {
  return {
    id: row.id as string,
    recordId: row.record_id as string,
    fromStatus: row.from_status as string,
    toStatus: row.to_status as string,
    changedBy: row.changed_by as string,
    changedAt: row.changed_at as string,
    reason: row.reason as string,
  }
}

function rowToAuditLog(row: Record<string, unknown>): AuditLog {
  return {
    id: row.id as string,
    recordId: row.record_id as string,
    action: row.action as ActionType,
    operator: row.operator as string,
    operatedAt: row.operated_at as string,
    detail: row.detail as string,
  }
}

export function getAllRecords(filters?: { source?: string; status?: string; search?: string }): QueueRecord[] {
  let sql = 'SELECT * FROM queue_records WHERE 1=1'
  const params: unknown[] = []

  if (filters?.source) {
    sql += ' AND source = ?'
    params.push(filters.source)
  }
  if (filters?.status) {
    sql += ' AND status = ?'
    params.push(filters.status)
  }
  if (filters?.search) {
    sql += ' AND (activity_id LIKE ? OR content LIKE ? OR submitted_by LIKE ?)'
    const term = `%${filters.search}%`
    params.push(term, term, term)
  }

  sql += ' ORDER BY submitted_at DESC'

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
  return rows.map(rowToRecord)
}

export function getRecordById(id: string): RecordDetail | null {
  const row = db.prepare('SELECT * FROM queue_records WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!row) return null

  const record = rowToRecord(row)

  const scRows = db.prepare('SELECT * FROM status_changes WHERE record_id = ? ORDER BY changed_at DESC').all(id) as Record<string, unknown>[]
  const statusChanges = scRows.map(rowToStatusChange)

  const alRows = db.prepare('SELECT * FROM audit_logs WHERE record_id = ? ORDER BY operated_at DESC').all(id) as Record<string, unknown>[]
  const auditLogs = alRows.map(rowToAuditLog)

  let relatedRecords: QueueRecord[] = []
  if (record.relatedRecordId) {
    const relRow = db.prepare('SELECT * FROM queue_records WHERE id = ?').get(record.relatedRecordId) as Record<string, unknown> | undefined
    if (relRow) relatedRecords = [rowToRecord(relRow)]
  }
  const duplicateRows = db.prepare('SELECT * FROM queue_records WHERE related_record_id = ?').all(id) as Record<string, unknown>[]
  relatedRecords = [...relatedRecords, ...duplicateRows.map(rowToRecord)]

  return {
    ...record,
    statusChanges,
    auditLogs,
    relatedRecords,
  }
}

export function getAuditLogs(filters?: { operator?: string; recordId?: string }): AuditLog[] {
  let sql = 'SELECT * FROM audit_logs WHERE 1=1'
  const params: unknown[] = []

  if (filters?.operator) {
    sql += ' AND operator = ?'
    params.push(filters.operator)
  }
  if (filters?.recordId) {
    sql += ' AND record_id = ?'
    params.push(filters.recordId)
  }

  sql += ' ORDER BY operated_at DESC'

  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
  return rows.map(rowToAuditLog)
}

export function createRecord(data: {
  activityId: string
  source: string
  submittedBy: string
  content: string
  isDuplicate?: boolean
  isAnomaly?: boolean
  anomalyReason?: string
  relatedRecordId?: string
}): QueueRecord {
  const id = generateId('rec')
  const isDuplicate = data.isDuplicate ? 1 : 0
  const isAnomaly = data.isAnomaly ? 1 : 0

  db.prepare(`
    INSERT INTO queue_records (id, activity_id, source, status, submitted_by, content, is_duplicate, is_anomaly, anomaly_reason, related_record_id)
    VALUES (?, ?, ?, '待草表', ?, ?, ?, ?, ?, ?)
  `).run(id, data.activityId, data.source, data.submittedBy, data.content, isDuplicate, isAnomaly, data.anomalyReason ?? null, data.relatedRecordId ?? null)

  const row = db.prepare('SELECT * FROM queue_records WHERE id = ?').get(id) as Record<string, unknown>
  return rowToRecord(row)
}

export function updateRecordStatus(
  id: string,
  fromStatus: string,
  toStatus: string,
  changedBy: string,
  reason: string,
): QueueRecord | null {
  const result = db.prepare('UPDATE queue_records SET status = ? WHERE id = ? AND status = ?').run(toStatus, id, fromStatus)
  if (result.changes === 0) return null

  const row = db.prepare('SELECT * FROM queue_records WHERE id = ?').get(id) as Record<string, unknown>
  return rowToRecord(row)
}

export function findExistingRecords(activityId: string, source: string): QueueRecord[] {
  const rows = db.prepare('SELECT * FROM queue_records WHERE activity_id = ? AND source = ?').all(activityId, source) as Record<string, unknown>[]
  return rows.map(rowToRecord)
}

export function findPendingDraftRecords(activityId: string): QueueRecord[] {
  const rows = db.prepare("SELECT * FROM queue_records WHERE activity_id = ? AND status = '待草表'").all(activityId) as Record<string, unknown>[]
  return rows.map(rowToRecord)
}

export function insertStatusChange(
  recordId: string,
  fromStatus: string,
  toStatus: string,
  changedBy: string,
  reason: string,
): void {
  const id = generateId('sc')
  db.prepare(`
    INSERT INTO status_changes (id, record_id, from_status, to_status, changed_by, reason)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, recordId, fromStatus, toStatus, changedBy, reason)
}

export function insertAuditLog(
  recordId: string,
  action: ActionType,
  operator: string,
  detail: string,
): void {
  const id = generateId('log')
  db.prepare(`
    INSERT INTO audit_logs (id, record_id, action, operator, detail)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, recordId, action, operator, detail)
}
