import { getDb, saveDb } from '../db.js'
import { v4 as uuidv4 } from 'uuid'
import type { PhotoEntry } from '../types.js'
import fs from 'fs'
import path from 'path'

export function filePathToUrl(filePath: string): string {
  const uploadsDir = path.join(process.cwd(), 'uploads')
  const normalized = path.normalize(filePath)
  if (normalized.startsWith(uploadsDir)) {
    return '/uploads' + normalized.slice(uploadsDir.length).split(path.sep).join('/')
  }
  const parts = normalized.split(path.sep)
  const uploadsIdx = parts.lastIndexOf('uploads')
  if (uploadsIdx >= 0) {
    return '/' + parts.slice(uploadsIdx).join('/')
  }
  const basename = path.basename(normalized)
  return `/uploads/${basename}`
}

function getAccessStatus(filePath: string): PhotoEntry['accessStatus'] {
  try {
    if (!fs.existsSync(filePath)) return 'missing'
    fs.accessSync(filePath, fs.constants.R_OK)
    return 'accessible'
  } catch (_e) {
    return 'inaccessible'
  }
}

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
    fileUrl: filePathToUrl(filePath),
    accessStatus: getAccessStatus(filePath),
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

  return rows.map((row: any[]) => {
    const filePath = row[2] as string
    return {
      id: row[0],
      recordId: row[1],
      filePath,
      fileUrl: filePathToUrl(filePath),
      accessStatus: getAccessStatus(filePath),
      description: row[3],
      uploadedAt: row[4],
    }
  })
}
