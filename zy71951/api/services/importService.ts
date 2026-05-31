import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../database.js'
import { logAuditEvent } from './auditService.js'
import { createRecord, getRecordByUniqueKey, addAttachment, addCorrection } from './recordService.js'
import type {
  ParsedItem, ParsedResult, UploadResponse, ImportBatch, ImportBatchRow,
  ImportItem, ImportItemRow, ImportDecision, ConfirmImportRequest, ItemType,
} from '../types.js'

function rowToImportBatch(row: ImportBatchRow): ImportBatch {
  return {
    id: row.id,
    batchName: row.batch_name,
    importedAt: row.imported_at,
    importedBy: row.imported_by,
    totalItems: row.total_items,
    normalCount: row.normal_count,
    lateCount: row.late_count,
    duplicateCount: row.duplicate_count,
    correctionCount: row.correction_count,
    status: row.status,
  }
}

function rowToImportItem(row: ImportItemRow): ImportItem {
  return {
    id: row.id,
    batchId: row.batch_id,
    itemType: row.item_type,
    data: JSON.parse(row.data || '{}'),
    actionTaken: row.action_taken ?? undefined,
    processedAt: row.processed_at ?? undefined,
  }
}

function resolveRecordIdFromData(data: Record<string, unknown>): string | null {
  const towerId = String(data.towerId ?? data.tower_id ?? '')
  const flightDate = String(data.flightDate ?? data.flight_date ?? '')
  const flightTime = String(data.flightTime ?? data.flight_time ?? '')
  const pilotName = String(data.pilotName ?? data.pilot_name ?? '')

  if (!towerId || !flightDate || !flightTime || !pilotName) {
    const directId = String(data.recordId ?? data.record_id ?? '')
    return directId || null
  }

  const db = getDb()
  const row = db.prepare('SELECT id FROM inspection_records WHERE tower_id = ? AND flight_date = ? AND flight_time = ? AND pilot_name = ?').get(towerId, flightDate, flightTime, pilotName) as { id: string } | undefined
  return row?.id ?? null
}

function getAnyRecordId(): string | null {
  const db = getDb()
  const row = db.prepare('SELECT id FROM inspection_records LIMIT 1').get() as { id: string } | undefined
  return row?.id ?? null
}

export function parseImportData(records: Record<string, unknown>[]): ParsedResult {
  const items: ParsedItem[] = []
  let normalRecords = 0
  let lateAttachments = 0
  let duplicates = 0
  let manualCorrections = 0
  const seen = new Map<string, string>()

  for (const record of records) {
    const towerId = String(record.towerId ?? record.tower_id ?? '')
    const flightDate = String(record.flightDate ?? record.flight_date ?? '')
    const flightTime = String(record.flightTime ?? record.flight_time ?? '')
    const pilotName = String(record.pilotName ?? record.pilot_name ?? '')
    const uniqueKey = `${towerId}|${flightDate}|${flightTime}|${pilotName}`

    if (record._type === 'late_attachment') {
      lateAttachments++
      items.push({
        id: uuidv4(),
        type: 'late_attachment',
        data: record,
        lateFor: String(record.lateFor ?? record.record_id ?? ''),
      })
      continue
    }

    if (record._type === 'manual_correction') {
      manualCorrections++
      items.push({
        id: uuidv4(),
        type: 'manual_correction',
        data: record,
        originalValue: String(record.originalValue ?? record.old_value ?? ''),
        correctedValue: String(record.correctedValue ?? record.new_value ?? ''),
      })
      continue
    }

    if (seen.has(uniqueKey)) {
      duplicates++
      items.push({
        id: uuidv4(),
        type: 'duplicate',
        data: record,
        duplicateOf: seen.get(uniqueKey)!,
      })
      continue
    }

    seen.set(uniqueKey, uuidv4())
    normalRecords++
    items.push({
      id: uuidv4(),
      type: 'normal',
      data: record,
    })
  }

  return { normalRecords, lateAttachments, duplicates, manualCorrections, items }
}

export function createImportBatch(batchName: string, importedBy: string, parsed: ParsedResult): UploadResponse {
  const db = getDb()
  const batchId = uuidv4()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO import_batches (id, batch_name, imported_at, imported_by, total_items, normal_count, late_count, duplicate_count, correction_count, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(batchId, batchName, now, importedBy, parsed.items.length, parsed.normalRecords, parsed.lateAttachments, parsed.duplicates, parsed.manualCorrections, 'pending')

  const insertItem = db.prepare(`
    INSERT INTO import_items (id, batch_id, item_type, data)
    VALUES (?, ?, ?, ?)
  `)

  for (const item of parsed.items) {
    insertItem.run(item.id, batchId, item.type, JSON.stringify(item.data))
  }

  const auditRecordId = getAnyRecordId()
  if (auditRecordId) {
    logAuditEvent(auditRecordId, 'import', importedBy, `创建导入批次[${batchName}]，共${parsed.items.length}条数据`, {
      batchId,
      normalRecords: parsed.normalRecords,
      lateAttachments: parsed.lateAttachments,
      duplicates: parsed.duplicates,
      manualCorrections: parsed.manualCorrections,
    })
  }

  return { batchId, parsed }
}

export function confirmImport(req: ConfirmImportRequest, actor: string = 'system'): ImportBatch {
  const db = getDb()
  const { batchId, decisions } = req

  const batchRow = db.prepare('SELECT * FROM import_batches WHERE id = ?').get(batchId) as ImportBatchRow | undefined
  if (!batchRow) throw new Error(`批次${batchId}不存在`)
  if (batchRow.status === 'completed') return rowToImportBatch(batchRow)

  db.prepare("UPDATE import_batches SET status = 'processing' WHERE id = ?").run(batchId)

  const decisionMap = new Map(decisions.map(d => [d.itemId, d]))
  const items = db.prepare('SELECT * FROM import_items WHERE batch_id = ?').all(batchId) as ImportItemRow[]

  const processItem = db.transaction((item: ImportItemRow, decision: ImportDecision) => {
    const data = JSON.parse(item.data) as Record<string, unknown>
    const now = new Date().toISOString()

    switch (decision.action) {
      case 'accept': {
        if (item.item_type === 'normal') {
          const towerId = String(data.towerId ?? data.tower_id ?? '')
          const towerName = String(data.towerName ?? data.tower_name ?? '')
          const flightDate = String(data.flightDate ?? data.flight_date ?? '')
          const flightTime = String(data.flightTime ?? data.flight_time ?? '')
          const pilotName = String(data.pilotName ?? data.pilot_name ?? '')

          try {
            createRecord({ towerId, towerName, flightDate, flightTime, pilotName, flightData: data, actor })
          } catch {
            // INSERT OR IGNORE by unique index
          }
        } else if (item.item_type === 'late_attachment') {
          const recordId = String(data.lateFor ?? data.record_id ?? '')
          if (recordId) {
            addAttachment(recordId, {
              fileName: String(data.fileName ?? data.file_name ?? 'unknown'),
              fileSize: Number(data.fileSize ?? data.file_size ?? 0),
              fileType: String(data.fileType ?? data.file_type ?? 'unknown'),
              source: 'late_arrival',
              filePath: String(data.filePath ?? data.file_path ?? ''),
            }, actor)
          }
        }
        break
      }
      case 'merge': {
        const targetId = decision.mergeTargetId
        if (targetId && item.item_type === 'duplicate') {
          logAuditEvent(targetId, 'import', actor, `重复项合并至记录${targetId}`, {
            sourceItemId: item.id,
            mergedData: data,
          })
        }
        break
      }
      case 'reject': {
        const rejectRecordId = resolveRecordIdFromData(data) ?? getAnyRecordId()
        if (rejectRecordId) {
          logAuditEvent(rejectRecordId, 'import', actor, `拒绝导入项${item.id}`, {
            itemId: item.id,
            itemType: item.item_type,
            batchId,
          })
        }
        break
      }
      case 'correct': {
        if (item.item_type === 'manual_correction') {
          const recordId = String(data.recordId ?? data.record_id ?? '')
          const fieldName = String(data.fieldName ?? data.field_name ?? '')
          const newValue = String(data.correctedValue ?? data.new_value ?? '')
          const reason = decision.correctionReason ?? String(data.reason ?? '人工更正')

          if (recordId) {
            addCorrection(recordId, {
              fieldName,
              newValue,
              reason,
              correctedBy: actor,
            })
          }
        }
        break
      }
    }

    db.prepare(`
      UPDATE import_items SET action_taken = ?, processed_at = ? WHERE id = ?
    `).run(decision.action, now, item.id)
  })

  for (const item of items) {
    const decision = decisionMap.get(item.id) ?? { itemId: item.id, action: 'accept' as const }
    processItem(item, decision)
  }

  db.prepare("UPDATE import_batches SET status = 'completed' WHERE id = ?").run(batchId)

  const auditRecordId = getAnyRecordId()
  if (auditRecordId) {
    logAuditEvent(auditRecordId, 'import', actor, `导入批次处理完成`, { batchId, decisionCount: decisions.length })
  }

  const updated = db.prepare('SELECT * FROM import_batches WHERE id = ?').get(batchId) as ImportBatchRow
  return rowToImportBatch(updated)
}

export function getImportBatch(batchId: string): ImportBatch | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM import_batches WHERE id = ?').get(batchId) as ImportBatchRow | undefined
  if (!row) return null
  return rowToImportBatch(row)
}

export function getImportItems(batchId: string): ImportItem[] {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM import_items WHERE batch_id = ?').all(batchId) as ImportItemRow[]
  return rows.map(rowToImportItem)
}
