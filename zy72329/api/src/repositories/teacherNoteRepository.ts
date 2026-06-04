import { db } from '../db'
import type { TeacherNote } from '../../../shared/types'

interface TeacherNoteRow {
  id: string
  record_no: string
  date: string
  teacher_name: string
  amount: number
  item_type: string
  annotation: string
  import_batch_id: string
  imported_at: string
  imported_by: string
}

function rowToTeacherNote(row: TeacherNoteRow): TeacherNote {
  return {
    id: row.id,
    recordNo: row.record_no,
    date: row.date,
    teacherName: row.teacher_name,
    amount: row.amount,
    itemType: row.item_type,
    annotation: row.annotation,
    importBatchId: row.import_batch_id,
    importedAt: row.imported_at,
    importedBy: row.imported_by
  }
}

function teacherNoteToRow(note: TeacherNote): unknown[] {
  return [
    note.id,
    note.recordNo,
    note.date,
    note.teacherName,
    note.amount,
    note.itemType,
    note.annotation,
    note.importBatchId,
    note.importedAt,
    note.importedBy
  ]
}

const insertManyStmt = db.prepare(`
  INSERT INTO teacher_notes (
    id, record_no, date, teacher_name, amount, item_type,
    annotation, import_batch_id, imported_at, imported_by
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

const findByRecordNoStmt = db.prepare(`
  SELECT * FROM teacher_notes WHERE record_no = ?
`)

const findAllStmt = db.prepare(`
  SELECT * FROM teacher_notes
`)

const findByBatchIdStmt = db.prepare(`
  SELECT * FROM teacher_notes WHERE import_batch_id = ?
`)

export function insertMany(notes: TeacherNote[]): void {
  const tx = db.transaction((notesList: TeacherNote[]) => {
    for (const note of notesList) {
      insertManyStmt.run(...teacherNoteToRow(note))
    }
  })
  tx(notes)
}

export function findByRecordNo(recordNo: string): TeacherNote | undefined {
  const row = findByRecordNoStmt.get(recordNo) as TeacherNoteRow | undefined
  return row ? rowToTeacherNote(row) : undefined
}

export function findAll(): TeacherNote[] {
  const rows = findAllStmt.all() as TeacherNoteRow[]
  return rows.map(rowToTeacherNote)
}

export function findByBatchId(batchId: string): TeacherNote[] {
  const rows = findByBatchIdStmt.all(batchId) as TeacherNoteRow[]
  return rows.map(rowToTeacherNote)
}

const findByIdStmt = db.prepare(`
  SELECT * FROM teacher_notes WHERE id = ?
`)

const countStmt = db.prepare(`
  SELECT COUNT(*) as count FROM teacher_notes
`)

export function findById(id: string): TeacherNote | undefined {
  const row = findByIdStmt.get(id) as TeacherNoteRow | undefined
  return row ? rowToTeacherNote(row) : undefined
}

export function count(): number {
  const result = countStmt.get() as { count: number }
  return result.count
}

interface TeacherNoteCreate {
  recordNo: string
  date: string
  teacherName: string
  amount: number
  itemType: string
  annotation: string
  importBatchId: string
  importedBy: string
}

export function create(data: TeacherNoteCreate): TeacherNote {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  const note: TeacherNote = {
    id,
    ...data,
    importedAt: now
  }
  const insertStmt = db.prepare(`
    INSERT INTO teacher_notes (
      id, record_no, date, teacher_name, amount, item_type,
      annotation, import_batch_id, imported_at, imported_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  insertStmt.run(...teacherNoteToRow(note))
  return findById(id)!
}

export function batchCreate(notes: TeacherNoteCreate[]): TeacherNote[] {
  const results: TeacherNote[] = []
  const tx = db.transaction((noteList: TeacherNoteCreate[]) => {
    for (const note of noteList) {
      results.push(create(note))
    }
  })
  tx(notes)
  return results
}
