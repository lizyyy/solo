import { v4 as uuidv4 } from 'uuid'
import db from '../database.js'
import type { AuditLog } from '../../shared/types.js'

function rowToAuditLog(row: any): AuditLog {
  return {
    id: row.id,
    batchId: row.batch_id,
    action: row.action,
    actor: row.actor,
    timestamp: row.timestamp,
    detail: row.detail,
    relatedId: row.related_id,
  }
}

export function createAuditLog(data: {
  batchId: string
  action: string
  actor?: string
  detail?: string
  relatedId?: string
}): AuditLog {
  const now = new Date().toISOString()
  const id = uuidv4()
  db.prepare(
    `INSERT INTO audit_log (id, batch_id, action, actor, timestamp, detail, related_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.batchId, data.action, data.actor ?? 'system', now, data.detail ?? '', data.relatedId ?? null)
  return {
    id, batchId: data.batchId, action: data.action as any,
    actor: data.actor ?? 'system', timestamp: now,
    detail: data.detail ?? '', relatedId: data.relatedId ?? '',
  }
}

export function getAuditLogsByBatch(batchId: string): AuditLog[] {
  const rows = db.prepare('SELECT * FROM audit_log WHERE batch_id = ? ORDER BY timestamp DESC').all(batchId) as any[]
  return rows.map(rowToAuditLog)
}
