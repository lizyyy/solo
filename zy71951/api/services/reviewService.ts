import { getDb } from '../database.js'
import { getFilteredRecordRows } from './recordService.js'
import type { InspectionRecord, RecordRow, GetReviewRequest, ReviewData, ReviewSummary, ChartData } from '../types.js'

function rowToRecordBasic(row: RecordRow): InspectionRecord {
  const db = getDb()
  const judgments = db.prepare('SELECT * FROM judgments WHERE record_id = ? ORDER BY triggered_at DESC').all(row.id) as any[]
  const attachments = db.prepare('SELECT * FROM attachments WHERE record_id = ? ORDER BY arrived_at DESC').all(row.id) as any[]
  const corrections = db.prepare('SELECT * FROM corrections WHERE record_id = ? ORDER BY corrected_at DESC').all(row.id) as any[]
  const auditEvents = db.prepare('SELECT * FROM audit_events WHERE record_id = ? ORDER BY timestamp DESC').all(row.id) as any[]

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

export function getReviewData(params: GetReviewRequest): ReviewData {
  const { dateFrom, dateTo, towerIds, status } = params

  const rows = getFilteredRecordRows({ dateFrom, dateTo, towerIds, status })
  const records = rows.map(rowToRecordBasic)

  const totalFlights = records.length
  const normalCount = records.filter(r => r.status === 'normal').length
  const warningCount = records.filter(r => r.status === 'warning').length
  const criticalCount = records.filter(r => r.status === 'critical').length
  const correctedCount = records.filter(r => r.status === 'corrected').length

  const noFlyZoneEdges = records.reduce((count, r) => {
    return count + r.judgments.filter(j => j.ruleType === 'no_fly_zone').length
  }, 0)

  const totalAttachments = records.reduce((count, r) => count + r.attachments.length, 0)
  const lateAttachments = records.reduce((count, r) => count + r.attachments.filter(a => a.source === 'late_arrival').length, 0)
  const lateAttachmentRate = totalAttachments > 0 ? Math.round((lateAttachments / totalAttachments) * 10000) / 100 : 0

  const db = getDb()
  const totalRecordsRow = db.prepare('SELECT COUNT(*) as count FROM inspection_records').get() as { count: number }
  const duplicateItemsRow = db.prepare("SELECT COUNT(*) as count FROM import_items WHERE item_type = 'duplicate'").get() as { count: number }
  const duplicateRate = totalRecordsRow.count > 0 ? Math.round((duplicateItemsRow.count / (totalRecordsRow.count + duplicateItemsRow.count)) * 10000) / 100 : 0

  const summary: ReviewSummary = {
    totalFlights,
    normalCount,
    warningCount,
    criticalCount,
    correctedCount,
    noFlyZoneEdges,
    lateAttachmentRate,
    duplicateRate,
  }

  const statusChart: ChartData[] = [
    { name: '正常', value: normalCount, category: 'status' },
    { name: '警告', value: warningCount, category: 'status' },
    { name: '严重', value: criticalCount, category: 'status' },
    { name: '已更正', value: correctedCount, category: 'status' },
  ]

  const towerMap = new Map<string, number>()
  for (const r of records) {
    const count = towerMap.get(r.towerName) ?? 0
    towerMap.set(r.towerName, count + 1)
  }
  const towerChart: ChartData[] = Array.from(towerMap.entries()).map(([name, value]) => ({
    name,
    value,
    category: 'tower',
  }))

  const dateMap = new Map<string, { total: number; anomaly: number }>()
  for (const r of records) {
    const stat = dateMap.get(r.flightDate) ?? { total: 0, anomaly: 0 }
    stat.total++
    if (r.status !== 'normal') stat.anomaly++
    dateMap.set(r.flightDate, stat)
  }
  const trendChart: ChartData[] = Array.from(dateMap.entries()).map(([name, stat]) => ({
    name,
    value: stat.anomaly,
    category: 'anomaly_trend',
  }))

  const charts = [...statusChart, ...towerChart, ...trendChart]

  return { summary, records, charts }
}
