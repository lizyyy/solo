import { v4 as uuidv4 } from 'uuid'
import db from '../database.js'
import type { MergedPoint, EvidenceRecord, AppendedNote } from '../../shared/types.js'

function rowToMergedPoint(row: any): MergedPoint {
  return {
    id: row.id,
    batchId: row.batch_id,
    gisId: row.gis_id,
    address: row.address,
    businessType: row.business_type,
    area: row.area,
    sourceCount: row.source_count,
    conflictStatus: row.conflict_status,
    originalNotes: row.original_notes,
    appendedNotes: [],
    sources: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function createMergedPoint(data: {
  batchId: string
  gisId?: string
  address: string
  businessType?: string
  area?: number
  sourceCount?: number
  conflictStatus?: string
  originalNotes?: string
}): MergedPoint {
  const now = new Date().toISOString()
  const id = uuidv4()
  db.prepare(
    `INSERT INTO merged_point (id, batch_id, gis_id, address, business_type, area, source_count, conflict_status, original_notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, data.batchId, data.gisId ?? null, data.address,
    data.businessType ?? null, data.area ?? null,
    data.sourceCount ?? 1, data.conflictStatus ?? 'none',
    data.originalNotes ?? '', now, now
  )
  return {
    id, batchId: data.batchId, gisId: data.gisId ?? '', address: data.address,
    businessType: data.businessType ?? '', area: data.area ?? 0,
    sourceCount: data.sourceCount ?? 1, conflictStatus: (data.conflictStatus ?? 'none') as any,
    originalNotes: data.originalNotes ?? '', appendedNotes: [], sources: [],
    createdAt: now, updatedAt: now,
  }
}

export function getMergedPointsByBatch(batchId: string): MergedPoint[] {
  const rows = db.prepare('SELECT * FROM merged_point WHERE batch_id = ? ORDER BY created_at').all(batchId) as any[]
  return rows.map(row => {
    const point = rowToMergedPoint(row)
    point.sources = getEvidenceByPoint(row.id)
    point.appendedNotes = getAppendedNotesByPoint(row.id)
    return point
  })
}

export function getMergedPointById(id: string): MergedPoint | undefined {
  const row = db.prepare('SELECT * FROM merged_point WHERE id = ?').get(id) as any
  if (!row) return undefined
  const point = rowToMergedPoint(row)
  point.sources = getEvidenceByPoint(id)
  point.appendedNotes = getAppendedNotesByPoint(id)
  return point
}

export function updateMergedPointConflictStatus(id: string, conflictStatus: string): void {
  const now = new Date().toISOString()
  db.prepare('UPDATE merged_point SET conflict_status = ?, updated_at = ? WHERE id = ?').run(conflictStatus, now, id)
}

export function createEvidenceRecord(data: {
  mergedPointId: string
  sourceType: string
  fileName: string
  importTime: string
  processTime: string
  originalValue?: string
}): EvidenceRecord {
  const id = uuidv4()
  db.prepare(
    `INSERT INTO evidence_record (id, merged_point_id, source_type, file_name, import_time, process_time, original_value)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, data.mergedPointId, data.sourceType, data.fileName, data.importTime, data.processTime, data.originalValue ?? '')
  return {
    id, mergedPointId: data.mergedPointId, sourceType: data.sourceType as any,
    fileName: data.fileName, importTime: data.importTime, processTime: data.processTime,
    originalValue: data.originalValue ?? '',
  }
}

export function getEvidenceByPoint(mergedPointId: string): EvidenceRecord[] {
  const rows = db.prepare('SELECT * FROM evidence_record WHERE merged_point_id = ?').all(mergedPointId) as any[]
  return rows.map(r => ({
    id: r.id, mergedPointId: r.merged_point_id, sourceType: r.source_type,
    fileName: r.file_name, importTime: r.import_time, processTime: r.process_time,
    originalValue: r.original_value,
  }))
}

export function createAppendedNote(data: {
  mergedPointId: string
  content: string
  author: string
}): AppendedNote {
  const now = new Date().toISOString()
  const id = uuidv4()
  db.prepare(
    'INSERT INTO appended_note (id, merged_point_id, content, author, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, data.mergedPointId, data.content, data.author, now)
  return { id, mergedPointId: data.mergedPointId, content: data.content, author: data.author, createdAt: now }
}

export function getAppendedNotesByPoint(mergedPointId: string): AppendedNote[] {
  const rows = db.prepare('SELECT * FROM appended_note WHERE merged_point_id = ? ORDER BY created_at').all(mergedPointId) as any[]
  return rows.map(r => ({
    id: r.id, mergedPointId: r.merged_point_id, content: r.content,
    author: r.author, createdAt: r.created_at,
  }))
}
