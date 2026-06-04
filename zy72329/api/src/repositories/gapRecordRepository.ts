import { db } from '../db'
import type { GapRecord, GapReviewStatus } from '../../../shared/types'

interface GapRecordRow {
  id: string
  record_id: string
  missing_record_no: string
  previous_record_no: string
  next_record_no: string
  review_status: string
  review_note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
}

function rowToGapRecord(row: GapRecordRow): GapRecord {
  return {
    id: row.id,
    recordId: row.record_id,
    missingRecordNo: row.missing_record_no,
    previousRecordNo: row.previous_record_no,
    nextRecordNo: row.next_record_no,
    reviewStatus: row.review_status as GapReviewStatus,
    reviewNote: row.review_note ?? undefined,
    reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined,
    createdAt: row.created_at
  }
}

function gapRecordToRow(gap: GapRecord): unknown[] {
  return [
    gap.id,
    gap.recordId,
    gap.missingRecordNo,
    gap.previousRecordNo,
    gap.nextRecordNo,
    gap.reviewStatus,
    gap.reviewNote ?? null,
    gap.reviewedBy ?? null,
    gap.reviewedAt ?? null,
    gap.createdAt
  ]
}

const insertStmt = db.prepare(`
  INSERT INTO gap_records (
    id, record_id, missing_record_no, previous_record_no, next_record_no,
    review_status, review_note, reviewed_by, reviewed_at, created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const updateReviewStmt = db.prepare(`
  UPDATE gap_records SET review_status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?
`)

const findAllStmt = db.prepare(`
  SELECT * FROM gap_records
`)

const findByIdStmt = db.prepare(`
  SELECT * FROM gap_records WHERE id = ?
`)

const findByRecordIdStmt = db.prepare(`
  SELECT * FROM gap_records WHERE record_id = ?
`)

export function insert(gap: GapRecord): string {
  insertStmt.run(...gapRecordToRow(gap))
  return gap.id
}

export function updateReview(id: string, status: 'normal' | 'abnormal', note: string, reviewedBy: string): void {
  updateReviewStmt.run(status, note, reviewedBy, new Date().toISOString(), id)
}

export function findAll(): GapRecord[] {
  const rows = findAllStmt.all() as GapRecordRow[]
  return rows.map(rowToGapRecord)
}

export function findById(id: string): GapRecord | undefined {
  const row = findByIdStmt.get(id) as GapRecordRow | undefined
  return row ? rowToGapRecord(row) : undefined
}

export function findByRecordId(recordId: string): GapRecord | undefined {
  const row = findByRecordIdStmt.get(recordId) as GapRecordRow | undefined
  return row ? rowToGapRecord(row) : undefined
}

interface GapRecordCreate {
  recordId: string
  missingRecordNo: string
  previousRecordNo: string
  nextRecordNo: string
}

export function create(data: GapRecordCreate): GapRecord {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const gap: GapRecord = {
    id,
    ...data,
    reviewStatus: 'pending',
    createdAt: now
  }
  insertStmt.run(...gapRecordToRow(gap))
  return findById(id)!
}

export function review(
  id: string,
  data: {
    status: 'normal' | 'abnormal'
    note: string
    reviewedBy: string
  }
): GapRecord {
  updateReview(id, data.status, data.note, data.reviewedBy)
  return findById(id)!
}
