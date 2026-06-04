import { db } from '../db'
import type { ConflictRecord, ConflictResolution } from '../../../shared/types'

interface ConflictRecordRow {
  id: string
  record_id: string
  teacher_note_id: string
  sampling_list_id: string
  conflicting_fields: string
  resolution: string | null
  resolution_note: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
}

function rowToConflictRecord(row: ConflictRecordRow): ConflictRecord {
  return {
    id: row.id,
    recordId: row.record_id,
    teacherNoteId: row.teacher_note_id,
    samplingListId: row.sampling_list_id,
    conflictingFields: JSON.parse(row.conflicting_fields),
    resolution: row.resolution as ConflictResolution | undefined,
    resolutionNote: row.resolution_note ?? undefined,
    resolvedBy: row.resolved_by ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    createdAt: row.created_at
  }
}

function conflictRecordToRow(conflict: ConflictRecord): unknown[] {
  return [
    conflict.id,
    conflict.recordId,
    conflict.teacherNoteId,
    conflict.samplingListId,
    JSON.stringify(conflict.conflictingFields),
    conflict.resolution ?? null,
    conflict.resolutionNote ?? null,
    conflict.resolvedBy ?? null,
    conflict.resolvedAt ?? null,
    conflict.createdAt
  ]
}

const insertStmt = db.prepare(`
  INSERT INTO conflict_records (
    id, record_id, teacher_note_id, sampling_list_id, conflicting_fields,
    resolution, resolution_note, resolved_by, resolved_at, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const updateResolutionStmt = db.prepare(`
  UPDATE conflict_records SET resolution = ?, resolution_note = ?, resolved_by = ?, resolved_at = ? WHERE id = ?
`)

const findAllStmt = db.prepare(`
  SELECT * FROM conflict_records
`)

const findByIdStmt = db.prepare(`
  SELECT * FROM conflict_records WHERE id = ?
`)

const findByRecordIdStmt = db.prepare(`
  SELECT * FROM conflict_records WHERE record_id = ?
`)

export function insert(conflict: ConflictRecord): string {
  insertStmt.run(...conflictRecordToRow(conflict))
  return conflict.id
}

export function updateResolution(id: string, resolution: ConflictResolution, note: string, resolvedBy: string): void {
  updateResolutionStmt.run(resolution, note, resolvedBy, new Date().toISOString(), id)
}

export function findAll(): ConflictRecord[] {
  const rows = findAllStmt.all() as ConflictRecordRow[]
  return rows.map(rowToConflictRecord)
}

export function findById(id: string): ConflictRecord | undefined {
  const row = findByIdStmt.get(id) as ConflictRecordRow | undefined
  return row ? rowToConflictRecord(row) : undefined
}

export function findByRecordId(recordId: string): ConflictRecord | undefined {
  const row = findByRecordIdStmt.get(recordId) as ConflictRecordRow | undefined
  return row ? rowToConflictRecord(row) : undefined
}

interface ConflictRecordCreate {
  recordId: string
  teacherNoteId: string
  samplingListId: string
  conflictingFields: Array<{
    field: string
    teacherNoteValue: string | number
    samplingListValue: string | number
  }>
}

export function create(data: ConflictRecordCreate): ConflictRecord {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const conflict: ConflictRecord = {
    id,
    ...data,
    createdAt: now
  }
  insertStmt.run(...conflictRecordToRow(conflict))
  return findById(id)!
}

export function resolve(
  id: string,
  data: {
    resolution: ConflictResolution
    note: string
    resolvedBy: string
  }
): ConflictRecord {
  updateResolution(id, data.resolution, data.note, data.resolvedBy)
  return findById(id)!
}
