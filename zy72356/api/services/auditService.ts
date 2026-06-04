import { getDb } from '../db.js'
import { v4 as uuidv4 } from 'uuid'
import type { AuditLogEntry } from '../types.js'

export async function createAuditLog(
  recordId: string,
  action: AuditLogEntry['action'],
  operatorRole: string,
  oldValue: string | null,
  newValue: string | null,
  note: string | null = null
): Promise<AuditLogEntry> {
  const db = await getDb()
  const id = uuidv4()
  const now = new Date().toISOString()
  db.run(`
    INSERT INTO audit_logs (id, record_id, action, operator_role, old_value, new_value, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, recordId, action, operatorRole, oldValue, newValue, note, now])
  return { id, recordId, action, operatorRole, oldValue, newValue, note, createdAt: now }
}

export async function getAuditLogsByRecordId(recordId: string): Promise<AuditLogEntry[]> {
  const db = await getDb()
  const rows = db.exec(`
    SELECT * FROM audit_logs WHERE record_id = ? ORDER BY created_at ASC
  `, [recordId])[0]?.values || []
  return rows.map((row: any[]) => ({
    id: row[0],
    recordId: row[1],
    action: row[2],
    operatorRole: row[3],
    oldValue: row[4],
    newValue: row[5],
    note: row[6],
    createdAt: row[7],
  }))
}
