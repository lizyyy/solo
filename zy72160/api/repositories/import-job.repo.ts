import { v4 as uuidv4 } from 'uuid'
import db from '../database.js'
import type { ImportJob } from '../../shared/types.js'

export function createImportJob(data: {
  batchId: string
  sourceType: string
  fileName: string
  recordCount: number
  fieldMapping: Record<string, string>
  rawPreview: Record<string, unknown>[]
}): ImportJob {
  const now = new Date().toISOString()
  const id = uuidv4()
  db.prepare(
    `INSERT INTO import_job (id, batch_id, source_type, file_name, import_time, status, record_count, field_mapping, raw_preview)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    data.batchId,
    data.sourceType,
    data.fileName,
    now,
    'previewing',
    data.recordCount,
    JSON.stringify(data.fieldMapping),
    JSON.stringify(data.rawPreview)
  )
  return {
    id,
    batchId: data.batchId,
    sourceType: data.sourceType as any,
    fileName: data.fileName,
    importTime: now,
    status: 'previewing',
    recordCount: data.recordCount,
    fieldMapping: data.fieldMapping,
    rawPreview: data.rawPreview,
  }
}

function rowToImportJob(row: any): ImportJob {
  return {
    id: row.id,
    batchId: row.batch_id,
    sourceType: row.source_type,
    fileName: row.file_name,
    importTime: row.import_time,
    status: row.status,
    recordCount: row.record_count,
    fieldMapping: row.field_mapping ? JSON.parse(row.field_mapping) : {},
    rawPreview: row.raw_preview ? JSON.parse(row.raw_preview) : [],
  }
}

export function getImportJobsByBatch(batchId: string): ImportJob[] {
  const rows = db.prepare('SELECT * FROM import_job WHERE batch_id = ? ORDER BY import_time DESC').all(batchId) as any[]
  return rows.map(rowToImportJob)
}

export function getImportJobById(id: string): ImportJob | undefined {
  const row = db.prepare('SELECT * FROM import_job WHERE id = ?').get(id) as any
  if (!row) return undefined
  return rowToImportJob(row)
}

export function updateImportJobMapping(id: string, fieldMapping: Record<string, string>): void {
  db.prepare('UPDATE import_job SET field_mapping = ?, status = ? WHERE id = ?').run(
    JSON.stringify(fieldMapping),
    'previewing',
    id
  )
}

export function updateImportJobStatus(id: string, status: string): void {
  db.prepare('UPDATE import_job SET status = ? WHERE id = ?').run(status, id)
}

export function createRawRecords(
  importJobId: string,
  records: { rawData: Record<string, unknown>; mappedData?: Record<string, unknown> }[]
): void {
  const stmt = db.prepare(
    'INSERT INTO raw_record (id, import_job_id, row_index, raw_data, mapped_data) VALUES (?, ?, ?, ?, ?)'
  )
  const insertAll = db.transaction(() => {
    records.forEach((r, index) => {
      stmt.run(uuidv4(), importJobId, index, JSON.stringify(r.rawData), r.mappedData ? JSON.stringify(r.mappedData) : null)
    })
  })
  insertAll()
}

export function updateRawRecordsMappedData(importJobId: string, records: { id: string; mappedData: Record<string, unknown> }[]): void {
  const stmt = db.prepare('UPDATE raw_record SET mapped_data = ? WHERE id = ?')
  const updateAll = db.transaction(() => {
    for (const r of records) {
      stmt.run(JSON.stringify(r.mappedData), r.id)
    }
  })
  updateAll()
}

export function getRawRecordsByJob(importJobId: string): any[] {
  const rows = db.prepare('SELECT * FROM raw_record WHERE import_job_id = ? ORDER BY row_index').all(importJobId) as any[]
  return rows.map(r => ({
    id: r.id,
    importJobId: r.import_job_id,
    rowIndex: r.row_index,
    rawData: JSON.parse(r.raw_data),
    mappedData: r.mapped_data ? JSON.parse(r.mapped_data) : null,
  }))
}
