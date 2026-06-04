import { db } from '../db'
import type { SamplingList } from '../../../shared/types'

interface SamplingListRow {
  id: string
  record_no: string
  date: string
  teacher_name: string
  amount: number
  item_type: string
  scene_description: string
  is_old_format: number
  import_batch_id: string
  imported_at: string
  imported_by: string
}

function rowToSamplingList(row: SamplingListRow): SamplingList {
  return {
    id: row.id,
    recordNo: row.record_no,
    date: row.date,
    teacherName: row.teacher_name,
    amount: row.amount,
    itemType: row.item_type,
    sceneDescription: row.scene_description,
    isOldFormat: row.is_old_format === 1,
    importBatchId: row.import_batch_id,
    importedAt: row.imported_at,
    importedBy: row.imported_by
  }
}

function samplingListToRow(record: SamplingList): unknown[] {
  return [
    record.id,
    record.recordNo,
    record.date,
    record.teacherName,
    record.amount,
    record.itemType,
    record.sceneDescription,
    record.isOldFormat ? 1 : 0,
    record.importBatchId,
    record.importedAt,
    record.importedBy
  ]
}

const insertManyStmt = db.prepare(`
  INSERT INTO sampling_lists (
    id, record_no, date, teacher_name, amount, item_type,
    scene_description, is_old_format, import_batch_id, imported_at, imported_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const findByRecordNoStmt = db.prepare(`
  SELECT * FROM sampling_lists WHERE record_no = ?
`)

const findAllStmt = db.prepare(`
  SELECT * FROM sampling_lists
`)

const findByBatchIdStmt = db.prepare(`
  SELECT * FROM sampling_lists WHERE import_batch_id = ?
`)

export function insertMany(records: SamplingList[]): void {
  const tx = db.transaction((recordsList: SamplingList[]) => {
    for (const record of recordsList) {
      insertManyStmt.run(...samplingListToRow(record))
    }
  })
  tx(records)
}

export function findByRecordNo(recordNo: string): SamplingList | undefined {
  const row = findByRecordNoStmt.get(recordNo) as SamplingListRow | undefined
  return row ? rowToSamplingList(row) : undefined
}

export function findAll(): SamplingList[] {
  const rows = findAllStmt.all() as SamplingListRow[]
  return rows.map(rowToSamplingList)
}

export function findByBatchId(batchId: string): SamplingList[] {
  const rows = findByBatchIdStmt.all(batchId) as SamplingListRow[]
  return rows.map(rowToSamplingList)
}

const findByIdStmt = db.prepare(`
  SELECT * FROM sampling_lists WHERE id = ?
`)

const countStmt = db.prepare(`
  SELECT COUNT(*) as count FROM sampling_lists
`)

export function findById(id: string): SamplingList | undefined {
  const row = findByIdStmt.get(id) as SamplingListRow | undefined
  return row ? rowToSamplingList(row) : undefined
}

export function count(): number {
  const result = countStmt.get() as { count: number }
  return result.count
}

interface SamplingListCreate {
  recordNo: string
  date: string
  teacherName: string
  amount: number
  itemType: string
  sceneDescription: string
  isOldFormat: boolean
  importBatchId: string
  importedBy: string
}

export function create(data: SamplingListCreate): SamplingList {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const record: SamplingList = {
    id,
    ...data,
    importedAt: now
  }
  const insertStmt = db.prepare(`
    INSERT INTO sampling_lists (
      id, record_no, date, teacher_name, amount, item_type,
      scene_description, is_old_format, import_batch_id, imported_at, imported_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  insertStmt.run(...samplingListToRow(record))
  return findById(id)!
}

export function batchCreate(lists: SamplingListCreate[]): SamplingList[] {
  const results: SamplingList[] = []
  const tx = db.transaction((listData: SamplingListCreate[]) => {
    for (const item of listData) {
      results.push(create(item))
    }
  })
  tx(lists)
  return results
}
