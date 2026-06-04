import { getDb, saveDb } from '../db.js'
import { v4 as uuidv4 } from 'uuid'
import type { PhotoEntry } from '../types.js'

export async function addPhoto(
  recordId: string,
  filePath: string,
  description: string | null
): Promise<PhotoEntry> {
  const db = await getDb()
  const id = uuidv4()
  const now = new Date().toISOString()

  db.run(`
    INSERT INTO photos (id, record_id, file_path, description, uploaded_at)
    VALUES (?, ?, ?, ?, ?)
  `, [id, recordId, filePath, description, now])

  saveDb()

  return {
    id,
    recordId,
    filePath,
    description,
    uploadedAt: now,
  }
}

export async function getPhotosByRecordId(recordId: string): Promise<PhotoEntry[]> {
  const db = await getDb()
  const rows = db.exec(
    'SELECT * FROM photos WHERE record_id = ? ORDER BY uploaded_at ASC',
    [recordId]
  )[0]?.values || []

  return rows.map((row: any[]) => ({
    id: row[0],
    recordId: row[1],
    filePath: row[2],
    description: row[3],
    uploadedAt: row[4],
  }))
}
