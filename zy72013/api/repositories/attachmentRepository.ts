import { getDb } from '../database.js'
import { v4 as uuidv4 } from 'uuid'
import type { Attachment } from '../../shared/types.js'

interface CreateAttachmentData {
  record_id: string
  file_name: string
  file_type: string
  original_remark: string
  file_path: string
}

export function findByRecordId(recordId: string): Attachment[] {
  const db = getDb()
  return db.prepare('SELECT * FROM attachments WHERE record_id = ? ORDER BY created_at DESC').all(recordId) as Attachment[]
}

export function create(data: CreateAttachmentData): Attachment {
  const db = getDb()
  const id = uuidv4()

  db.prepare(`
    INSERT INTO attachments (id, record_id, file_name, file_type, original_remark, file_path)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, data.record_id, data.file_name, data.file_type, data.original_remark, data.file_path)

  return db.prepare('SELECT * FROM attachments WHERE id = ?').get(id) as Attachment
}

export function deleteById(recordId: string, attachmentId: string): boolean {
  const db = getDb()
  const result = db.prepare('DELETE FROM attachments WHERE id = ? AND record_id = ?').run(attachmentId, recordId)
  return result.changes > 0
}
