import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../database.js'
import { logAuditEvent } from './auditService.js'
import { runJudgmentEngine, saveJudgments, confirmJudgment, getJudgmentsByRecordId } from './judgmentService.js'
import type {
  InspectionRecord, RecordRow, JudgmentRow, AttachmentRow, CorrectionRow, AuditEventRow,
  GetRecordsRequest, GetRecordsResponse, CreateCorrectionRequest, RecordStatus
} from '../types.js'

function rowToRecord(row: RecordRow, judgments: JudgmentRow[], attachments: AttachmentRow[], corrections: CorrectionRow[], auditEvents: AuditEventRow[]): InspectionRecord {
  return {
    id: row.id,
    towerId: row.tower_id,
    towerName: row.tower_name,
    flightDate: row.flight_date,
    flightTime: row.flight_time,
    pilotName: row.pilot_name,
    status: row.status,
    judgments: judgments.map(j => ({
      id: j.id,
      recordId: j.record_id,
      ruleName: j.rule_name,
      ruleType: j.rule_type,
      triggeredAt: j.triggered_at,
      matchedData: JSON.parse(j.matched_data || '{}'),
      conclusion: j.conclusion,
      reasoning: j.reasoning,
      suggestedAction: j.suggested_action,
      severity: j.severity,
      confirmed: j.confirmed === 1,
      confirmedBy: j.confirmed_by ?? undefined,
      confirmedAt: j.confirmed_at ?? undefined,
    })),
    attachments: attachments.map(a => ({
      id: a.id,
      recordId: a.record_id,
      fileName: a.file_name,
      fileSize: a.file_size,
      fileType: a.file_type,
      source: a.source,
      arrivedAt: a.arrived_at,
      filePath: a.file_path,
    })),
    corrections: corrections.map(c => ({
      id: c.id,
      recordId: c.record_id,
      fieldName: c.field_name,
      oldValue: c.old_value,
      newValue: c.new_value,
      reason: c.reason,
      correctedBy: c.corrected_by,
      correctedAt: c.corrected_at,
    })),
    auditTrail: auditEvents.map(e => ({
      id: e.id,
      recordId: e.record_id,
      eventType: e.event_type,
      timestamp: e.timestamp,
      actor: e.actor,
      description: e.description,
      details: JSON.parse(e.details || '{}'),
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function buildRecordFromRow(row: RecordRow): InspectionRecord {
  const db = getDb()
  const judgments = db.prepare('SELECT * FROM judgments WHERE record_id = ? ORDER BY triggered_at DESC').all(row.id) as JudgmentRow[]
  const attachments = db.prepare('SELECT * FROM attachments WHERE record_id = ? ORDER BY arrived_at DESC').all(row.id) as AttachmentRow[]
  const corrections = db.prepare('SELECT * FROM corrections WHERE record_id = ? ORDER BY corrected_at DESC').all(row.id) as CorrectionRow[]
  const auditEvents = db.prepare('SELECT * FROM audit_events WHERE record_id = ? ORDER BY timestamp DESC').all(row.id) as AuditEventRow[]
  return rowToRecord(row, judgments, attachments, corrections, auditEvents)
}

export function getRecords(params: GetRecordsRequest): GetRecordsResponse {
  const db = getDb()
  const { page = 1, pageSize = 20, dateFrom, dateTo, towerId, status, anomalyType } = params

  const conditions: string[] = []
  const values: unknown[] = []

  if (dateFrom) {
    conditions.push('flight_date >= ?')
    values.push(dateFrom)
  }
  if (dateTo) {
    conditions.push('flight_date <= ?')
    values.push(dateTo)
  }
  if (towerId) {
    conditions.push('tower_id = ?')
    values.push(towerId)
  }
  if (status) {
    conditions.push('status = ?')
    values.push(status)
  }
  if (anomalyType) {
    conditions.push(`id IN (SELECT record_id FROM judgments WHERE rule_type = ?)`)
    values.push(anomalyType)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const totalRow = db.prepare(`SELECT COUNT(*) as count FROM inspection_records ${where}`).get(...values) as { count: number }
  const total = totalRow.count

  const offset = (page - 1) * pageSize
  const rows = db.prepare(`
    SELECT * FROM inspection_records ${where}
    ORDER BY flight_date DESC, flight_time DESC
    LIMIT ? OFFSET ?
  `).all(...values, pageSize, offset) as RecordRow[]

  const records = rows.map(buildRecordFromRow)

  return { records, total, page, pageSize }
}

export function getRecordById(id: string): InspectionRecord | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM inspection_records WHERE id = ?').get(id) as RecordRow | undefined
  if (!row) return null
  return buildRecordFromRow(row)
}

export function createRecord(data: {
  towerId: string
  towerName: string
  flightDate: string
  flightTime: string
  pilotName: string
  flightData?: Record<string, unknown>
  actor?: string
}): InspectionRecord {
  const db = getDb()
  const id = uuidv4()
  const now = new Date().toISOString()
  const actor = data.actor || 'system'

  const result = runJudgmentEngine({ recordId: id, flightData: data.flightData || {} })
  const status = result.overallStatus

  db.prepare(`
    INSERT INTO inspection_records (id, tower_id, tower_name, flight_date, flight_time, pilot_name, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.towerId, data.towerName, data.flightDate, data.flightTime, data.pilotName, status, now, now)

  if (result.judgments.length > 0) {
    saveJudgments(id, result.judgments, actor)
  }

  logAuditEvent(id, 'import', actor, `创建巡检记录：杆塔${data.towerName}(${data.towerId})，飞行日期${data.flightDate}`, {
    towerId: data.towerId,
    flightDate: data.flightDate,
    status,
  })

  return getRecordById(id)!
}

export function updateRecordStatus(recordId: string, status: RecordStatus, actor: string = 'system'): InspectionRecord | null {
  const db = getDb()
  const record = getRecordById(recordId)
  if (!record) return null

  const oldStatus = record.status
  const now = new Date().toISOString()

  db.prepare(`
    UPDATE inspection_records SET status = ?, updated_at = ? WHERE id = ?
  `).run(status, now, recordId)

  logAuditEvent(recordId, 'status_change', actor, `记录状态从[${oldStatus}]变更为[${status}]`, {
    oldStatus,
    newStatus: status,
  })

  return getRecordById(recordId)
}

export function confirmRecordJudgment(recordId: string, judgmentId: string, confirmedBy: string): InspectionRecord | null {
  const record = getRecordById(recordId)
  if (!record) return null

  confirmJudgment(recordId, judgmentId, confirmedBy)

  const allJudgments = getJudgmentsByRecordId(recordId)
  const allConfirmed = allJudgments.every(j => j.confirmed)
  if (allConfirmed && record.status !== 'normal') {
    updateRecordStatus(recordId, 'corrected', confirmedBy)
  }

  return getRecordById(recordId)
}

export function addCorrection(recordId: string, req: CreateCorrectionRequest): InspectionRecord | null {
  const db = getDb()
  const record = getRecordById(recordId)
  if (!record) return null

  const id = uuidv4()
  const now = new Date().toISOString()

  const oldValue = (record as unknown as Record<string, unknown>)[req.fieldName] ?? ''

  db.prepare(`
    INSERT INTO corrections (id, record_id, field_name, old_value, new_value, reason, corrected_by, corrected_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, recordId, req.fieldName, String(oldValue), req.newValue, req.reason, req.correctedBy, now)

  if (req.fieldName === 'status') {
    updateRecordStatus(recordId, req.newValue as RecordStatus, req.correctedBy)
  } else {
    db.prepare(`
      UPDATE inspection_records SET ${req.fieldName} = ?, updated_at = ? WHERE id = ?
    `).run(req.newValue, now, recordId)
  }

  logAuditEvent(recordId, 'correction', req.correctedBy, `人工更正字段[${req.fieldName}]：${oldValue} → ${req.newValue}，原因：${req.reason}`, {
    fieldName: req.fieldName,
    oldValue: String(oldValue),
    newValue: req.newValue,
    reason: req.reason,
  })

  return getRecordById(recordId)
}

export function addAttachment(recordId: string, attachment: {
  fileName: string
  fileSize: number
  fileType: string
  source: 'original' | 'late_arrival'
  filePath: string
}, actor: string = 'system'): InspectionRecord | null {
  const db = getDb()
  const record = getRecordById(recordId)
  if (!record) return null

  const id = uuidv4()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO attachments (id, record_id, file_name, file_size, file_type, source, arrived_at, file_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, recordId, attachment.fileName, attachment.fileSize, attachment.fileType, attachment.source, now, attachment.filePath)

  logAuditEvent(recordId, 'attachment_add', actor, `添加${attachment.source === 'late_arrival' ? '晚到' : ''}附件：${attachment.fileName}`, {
    fileName: attachment.fileName,
    source: attachment.source,
    fileSize: attachment.fileSize,
  })

  return getRecordById(recordId)
}

export function getRecordByUniqueKey(towerId: string, flightDate: string, flightTime: string, pilotName: string): InspectionRecord | null {
  const db = getDb()
  const row = db.prepare(`
    SELECT * FROM inspection_records
    WHERE tower_id = ? AND flight_date = ? AND flight_time = ? AND pilot_name = ?
  `).get(towerId, flightDate, flightTime, pilotName) as RecordRow | undefined
  if (!row) return null
  return buildRecordFromRow(row)
}

export function getFilteredRecordRows(params: {
  dateFrom?: string
  dateTo?: string
  towerIds?: string[]
  status?: string[]
}): RecordRow[] {
  const db = getDb()
  const { dateFrom, dateTo, towerIds, status } = params

  const conditions: string[] = []
  const values: unknown[] = []

  if (dateFrom) {
    conditions.push('flight_date >= ?')
    values.push(dateFrom)
  }
  if (dateTo) {
    conditions.push('flight_date <= ?')
    values.push(dateTo)
  }
  if (towerIds && towerIds.length > 0) {
    const placeholders = towerIds.map(() => '?').join(',')
    conditions.push(`tower_id IN (${placeholders})`)
    values.push(...towerIds)
  }
  if (status && status.length > 0) {
    const placeholders = status.map(() => '?').join(',')
    conditions.push(`status IN (${placeholders})`)
    values.push(...status)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  return db.prepare(`
    SELECT * FROM inspection_records ${where}
    ORDER BY flight_date DESC, flight_time DESC
  `).all(...values) as RecordRow[]
}
