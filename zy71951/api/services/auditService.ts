import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../database.js'
import type { AuditEvent, AuditEventRow, EventType, GetAuditLogRequest, AuditLogResponse } from '../types.js'

function rowToAuditEvent(row: AuditEventRow): AuditEvent {
  return {
    id: row.id,
    recordId: row.record_id,
    eventType: row.event_type,
    timestamp: row.timestamp,
    actor: row.actor,
    description: row.description,
    details: JSON.parse(row.details || '{}'),
  }
}

export function logAuditEvent(
  recordId: string,
  eventType: EventType,
  actor: string,
  description: string,
  details: Record<string, unknown> = {}
): AuditEvent {
  const db = getDb()
  const id = uuidv4()
  const timestamp = new Date().toISOString()

  db.prepare(`
    INSERT INTO audit_events (id, record_id, event_type, timestamp, actor, description, details)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, recordId, eventType, timestamp, actor, description, JSON.stringify(details))

  return {
    id,
    recordId,
    eventType,
    timestamp,
    actor,
    description,
    details,
  }
}

export function getAuditLog(params: GetAuditLogRequest): AuditLogResponse {
  const db = getDb()
  const { recordId, eventType, dateFrom, dateTo, page = 1, pageSize = 20 } = params

  const conditions: string[] = []
  const values: unknown[] = []

  if (recordId) {
    conditions.push('record_id = ?')
    values.push(recordId)
  }
  if (eventType) {
    conditions.push('event_type = ?')
    values.push(eventType)
  }
  if (dateFrom) {
    conditions.push('timestamp >= ?')
    values.push(dateFrom)
  }
  if (dateTo) {
    conditions.push('timestamp <= ?')
    values.push(dateTo)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const totalRow = db.prepare(`SELECT COUNT(*) as count FROM audit_events ${where}`).get(...values) as { count: number }
  const total = totalRow.count

  const offset = (page - 1) * pageSize
  const rows = db.prepare(`
    SELECT * FROM audit_events ${where}
    ORDER BY timestamp DESC
    LIMIT ? OFFSET ?
  `).all(...values, pageSize, offset) as AuditEventRow[]

  return {
    events: rows.map(rowToAuditEvent),
    total,
  }
}

export function getRecentAnomalies(hours: number = 24, limit: number = 10): AuditEvent[] {
  const db = getDb()
  const rows = db.prepare(`
    SELECT * FROM audit_events
    WHERE event_type IN ('judgment', 'correction', 'status_change')
      AND timestamp >= datetime('now', '-${hours} hours')
    ORDER BY timestamp DESC
    LIMIT ?
  `).all(limit) as AuditEventRow[]

  return rows.map(rowToAuditEvent)
}
