import { db } from '../db'
import type { BillRecord, RecordStatus } from '../../../shared/types'

interface BillRecordRow {
  id: string
  record_no: string
  date: string
  teacher_name: string
  amount: number
  item_type: string
  status: string
  teacher_note_id: string | null
  sampling_list_id: string | null
  created_at: string
  updated_at: string
}

function rowToBillRecord(row: BillRecordRow): BillRecord {
  return {
    id: row.id,
    recordNo: row.record_no,
    date: row.date,
    teacherName: row.teacher_name,
    amount: row.amount,
    itemType: row.item_type,
    status: row.status as RecordStatus,
    teacherNoteId: row.teacher_note_id ?? undefined,
    samplingListId: row.sampling_list_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function billRecordToRow(record: BillRecord): unknown[] {
  return [
    record.id,
    record.recordNo,
    record.date,
    record.teacherName,
    record.amount,
    record.itemType,
    record.status,
    record.teacherNoteId ?? null,
    record.samplingListId ?? null,
    record.createdAt,
    record.updatedAt
  ]
}

const insertStmt = db.prepare(`
  INSERT INTO bill_records (
    id, record_no, date, teacher_name, amount, item_type,
    status, teacher_note_id, sampling_list_id, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const updateStatusStmt = db.prepare(`
  UPDATE bill_records SET status = ?, updated_at = ? WHERE id = ?
`)

const updateStmt = db.prepare(`
  UPDATE bill_records SET
    record_no = COALESCE(?, record_no),
    date = COALESCE(?, date),
    teacher_name = COALESCE(?, teacher_name),
    amount = COALESCE(?, amount),
    item_type = COALESCE(?, item_type),
    status = COALESCE(?, status),
    teacher_note_id = COALESCE(?, teacher_note_id),
    sampling_list_id = COALESCE(?, sampling_list_id),
    updated_at = ?
  WHERE id = ?
`)

const findAllStmt = db.prepare(`
  SELECT * FROM bill_records
`)

const findAllByStatusStmt = db.prepare(`
  SELECT * FROM bill_records WHERE status = ?
`)

const findByIdStmt = db.prepare(`
  SELECT * FROM bill_records WHERE id = ?
`)

const findByRecordNoStmt = db.prepare(`
  SELECT * FROM bill_records WHERE record_no = ?
`)

const countByStatusStmt = db.prepare(`
  SELECT status, COUNT(*) as count FROM bill_records GROUP BY status
`)

export function insert(record: BillRecord): string {
  insertStmt.run(...billRecordToRow(record))
  return record.id
}

export function updateStatus(id: string, status: RecordStatus): void {
  updateStatusStmt.run(status, new Date().toISOString(), id)
}

export function update(
  idOrRecord: string | (Partial<BillRecord> & { id: string }),
  data?: Partial<BillRecord>
): BillRecord | void {
  if (typeof idOrRecord === 'string') {
    const id = idOrRecord
    const now = new Date().toISOString()
    const fields: string[] = []
    const values: unknown[] = []

    if (data?.status !== undefined) {
      fields.push('status = ?')
      values.push(data.status)
    }
    if (data?.teacherNoteId !== undefined) {
      fields.push('teacher_note_id = ?')
      values.push(data.teacherNoteId ?? null)
    }
    if (data?.samplingListId !== undefined) {
      fields.push('sampling_list_id = ?')
      values.push(data.samplingListId ?? null)
    }

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    const stmt = db.prepare(`
      UPDATE bill_records SET ${fields.join(', ')} WHERE id = ?
    `)
    stmt.run(...values)
    return findById(id)!
  } else {
    const record = idOrRecord
    updateStmt.run(
      record.recordNo ?? null,
      record.date ?? null,
      record.teacherName ?? null,
      record.amount ?? null,
      record.itemType ?? null,
      record.status ?? null,
      record.teacherNoteId ?? null,
      record.samplingListId ?? null,
      new Date().toISOString(),
      record.id
    )
  }
}

export function findAll(status?: RecordStatus): BillRecord[] {
  const rows = status
    ? (findAllByStatusStmt.all(status) as BillRecordRow[])
    : (findAllStmt.all() as BillRecordRow[])
  return rows.map(rowToBillRecord)
}

export function findById(id: string): BillRecord | undefined {
  const row = findByIdStmt.get(id) as BillRecordRow | undefined
  return row ? rowToBillRecord(row) : undefined
}

export function findByRecordNo(recordNo: string): BillRecord | undefined {
  const row = findByRecordNoStmt.get(recordNo) as BillRecordRow | undefined
  return row ? rowToBillRecord(row) : undefined
}

export function countByStatus(): { [key: string]: number } {
  const rows = countByStatusStmt.all() as Array<{ status: string; count: number }>
  const result: { [key: string]: number } = {}
  for (const row of rows) {
    result[row.status] = row.count
  }
  return result
}

const countStmt = db.prepare(`
  SELECT COUNT(*) as count FROM bill_records
`)

const countByStatusFilterStmt = db.prepare(`
  SELECT COUNT(*) as count FROM bill_records WHERE status = ?
`)

export function count(status?: string): number {
  const result = status
    ? (countByStatusFilterStmt.get(status) as { count: number })
    : (countStmt.get() as { count: number })
  return result.count
}

const getRecordCountsStmt = db.prepare(`
  SELECT status, COUNT(*) as count 
  FROM bill_records 
  WHERE status IN ('smooth', 'gap', 'supplement', 'conflict')
  GROUP BY status
`)

export function getRecordCounts(): {
  smooth: number
  gap: number
  supplement: number
  conflict: number
} {
  const rows = getRecordCountsStmt.all() as Array<{ status: string; count: number }>
  const counts = { smooth: 0, gap: 0, supplement: 0, conflict: 0 }
  for (const row of rows) {
    if (row.status in counts) {
      counts[row.status as keyof typeof counts] = row.count
    }
  }
  return counts
}

interface BillRecordCreate {
  recordNo: string
  date: string
  teacherName: string
  amount: number
  itemType: string
  status: RecordStatus
  teacherNoteId?: string
  samplingListId?: string
}

export function create(data: BillRecordCreate): BillRecord {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const record: BillRecord = {
    id,
    ...data,
    createdAt: now,
    updatedAt: now
  }
  insertStmt.run(...billRecordToRow(record))
  return findById(id)!
}
