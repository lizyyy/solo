import { getDb } from '../database.js'
import { v4 as uuidv4 } from 'uuid'
import type { AuditLog } from '../../shared/types.js'

interface CreateAuditLogData {
  record_id: string
  action: string
  old_status: string
  new_status: string
  reason: string
  diff_summary: string
  operator?: string
}

export function findByRecordId(recordId: string): AuditLog[] {
  const db = getDb()
  return db.prepare('SELECT * FROM audit_logs WHERE record_id = ? ORDER BY created_at DESC').all(recordId) as AuditLog[]
}

export function create(data: CreateAuditLogData): AuditLog {
  const db = getDb()
  const id = uuidv4()
  const operator = data.operator || '资金组'

  db.prepare(`
    INSERT INTO audit_logs (id, record_id, action, old_status, new_status, reason, diff_summary, operator)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.record_id, data.action, data.old_status, data.new_status, data.reason, data.diff_summary, operator)

  return db.prepare('SELECT * FROM audit_logs WHERE id = ?').get(id) as AuditLog
}

export function findLastByRecordId(recordId: string): AuditLog | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM audit_logs WHERE record_id = ? ORDER BY created_at DESC LIMIT 1').get(recordId) as AuditLog | undefined
}
