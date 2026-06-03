import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../database.js'
import type { AuditLog, OperatorRole, AuditAction, CoordinateRecord } from '../../shared/types.js'

interface CreateAuditLogParams {
  record_id: string
  operator: string
  operator_role: OperatorRole
  action: AuditAction
  previous_status: string
  new_status: string
  change_detail: string
  snapshot: CoordinateRecord
}

export function createAuditLog(params: CreateAuditLogParams): AuditLog {
  const db = getDb()
  const id = uuidv4()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO audit_logs (id, record_id, operator, operator_role, action, previous_status, new_status, change_detail, snapshot, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.record_id,
    params.operator,
    params.operator_role,
    params.action,
    params.previous_status,
    params.new_status,
    params.change_detail,
    JSON.stringify(params.snapshot),
    now,
  )

  return {
    id,
    record_id: params.record_id,
    operator: params.operator,
    operator_role: params.operator_role,
    action: params.action,
    previous_status: params.previous_status,
    new_status: params.new_status,
    change_detail: params.change_detail,
    snapshot: JSON.stringify(params.snapshot),
    created_at: now,
  }
}

export function getAuditLogs(recordId: string): AuditLog[] {
  const db = getDb()
  return db.prepare('SELECT * FROM audit_logs WHERE record_id = ? ORDER BY created_at ASC').all(recordId) as AuditLog[]
}

export function rollbackToSnapshot(
  recordId: string,
  targetAuditLogId: string,
  operator: string,
  reason: string,
): CoordinateRecord {
  const db = getDb()
  const targetLog = db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(targetAuditLogId) as AuditLog | undefined
  if (!targetLog) throw new Error('Target audit log not found')

  const snapshot = JSON.parse(targetLog.snapshot) as CoordinateRecord

  const currentRecord = db.prepare('SELECT * FROM coordinate_records WHERE id = ?').get(recordId) as CoordinateRecord | undefined
  if (!currentRecord) throw new Error('Record not found')

  const previousStatus = currentRecord.status

  db.prepare(`
    UPDATE coordinate_records
    SET coordinate_type = ?, raw_latitude = ?, raw_longitude = ?, raw_metric_x = ?, raw_metric_y = ?,
        status = ?, retention_reason = ?, inspection_photo_id = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    snapshot.coordinate_type,
    snapshot.raw_latitude,
    snapshot.raw_longitude,
    snapshot.raw_metric_x,
    snapshot.raw_metric_y,
    snapshot.status,
    snapshot.retention_reason,
    snapshot.inspection_photo_id,
    recordId,
  )

  createAuditLog({
    record_id: recordId,
    operator,
    operator_role: 'inspector',
    action: 'rollback',
    previous_status: previousStatus,
    new_status: snapshot.status,
    change_detail: reason,
    snapshot: currentRecord,
  })

  const updated = db.prepare('SELECT * FROM coordinate_records WHERE id = ?').get(recordId) as CoordinateRecord
  return updated
}
