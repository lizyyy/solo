import { v4 as uuidv4 } from 'uuid'
import db from '../database.js'
import type { ConflictItem } from '../../shared/types.js'

function rowToConflictItem(row: any): ConflictItem {
  return {
    id: row.id,
    mergedPointId: row.merged_point_id,
    fieldName: row.field_name,
    gisValue: row.gis_value,
    importedValue: row.imported_value,
    gisSource: row.gis_source ? JSON.parse(row.gis_source) : {} as any,
    importSource: row.import_source ? JSON.parse(row.import_source) : {} as any,
    suggestion: row.suggestion,
    resolution: row.resolution,
    resolutionReason: row.resolution_reason,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
  }
}

export function createConflictItem(data: {
  mergedPointId: string
  fieldName: string
  gisValue?: string
  importedValue?: string
  gisSource?: any
  importSource?: any
  suggestion?: string
}): ConflictItem {
  const id = uuidv4()
  db.prepare(
    `INSERT INTO conflict_item (id, merged_point_id, field_name, gis_value, imported_value, gis_source, import_source, suggestion)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id, data.mergedPointId, data.fieldName,
    data.gisValue ?? null, data.importedValue ?? null,
    data.gisSource ? JSON.stringify(data.gisSource) : null,
    data.importSource ? JSON.stringify(data.importSource) : null,
    data.suggestion ?? 'manual'
  )
  return {
    id, mergedPointId: data.mergedPointId, fieldName: data.fieldName,
    gisValue: data.gisValue ?? '', importedValue: data.importedValue ?? '',
    gisSource: data.gisSource ?? {} as any, importSource: data.importSource ?? {} as any,
    suggestion: (data.suggestion ?? 'manual') as any,
    resolution: null, resolutionReason: null, resolvedAt: null, resolvedBy: null,
  }
}

export function getConflictsByBatch(batchId: string): ConflictItem[] {
  const rows = db.prepare(
    `SELECT ci.* FROM conflict_item ci
     JOIN merged_point mp ON ci.merged_point_id = mp.id
     WHERE mp.batch_id = ?
     ORDER BY ci.resolved_at IS NULL DESC, ci.id`
  ).all(batchId) as any[]
  return rows.map(rowToConflictItem)
}

export function getConflictById(id: string): ConflictItem | undefined {
  const row = db.prepare('SELECT * FROM conflict_item WHERE id = ?').get(id) as any
  if (!row) return undefined
  return rowToConflictItem(row)
}

export function getConflictsByPoint(mergedPointId: string): ConflictItem[] {
  const rows = db.prepare('SELECT * FROM conflict_item WHERE merged_point_id = ?').all(mergedPointId) as any[]
  return rows.map(rowToConflictItem)
}

export function resolveConflict(id: string, resolution: string, resolutionReason: string, resolvedBy: string): void {
  const now = new Date().toISOString()
  db.prepare(
    'UPDATE conflict_item SET resolution = ?, resolution_reason = ?, resolved_at = ?, resolved_by = ? WHERE id = ?'
  ).run(resolution, resolutionReason, now, resolvedBy, id)
}

export function countUnresolvedConflicts(mergedPointId: string): number {
  const row = db.prepare(
    "SELECT COUNT(*) as cnt FROM conflict_item WHERE merged_point_id = ? AND resolution IS NULL"
  ).get(mergedPointId) as any
  return row.cnt
}
