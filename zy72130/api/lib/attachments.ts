import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ATTACHMENTS_DIR = path.join(__dirname, '..', '..', 'data', 'attachments')

export interface AttachmentInfo {
  id: string
  fileName: string
  storedPath: string
  fileType: string
  fileSize: number
}

export function ensureAttachmentsDir(): string {
  if (!fs.existsSync(ATTACHMENTS_DIR)) {
    fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true })
  }
  return ATTACHMENTS_DIR
}

export function getAttachmentsDir(): string {
  return ATTACHMENTS_DIR
}

export function saveAttachment(
  sourcePath: string,
  originalName: string,
  fileId: string,
): AttachmentInfo {
  const dir = ensureAttachmentsDir()
  const ext = path.extname(originalName).toLowerCase()
  const storedName = `${fileId}${ext}`
  const storedPath = path.join(dir, storedName)

  fs.copyFileSync(sourcePath, storedPath)

  const stats = fs.statSync(storedPath)
  const fileType = getFileType(ext)

  return {
    id: fileId,
    fileName: originalName,
    storedPath: storedName,
    fileType,
    fileSize: stats.size,
  }
}

export function getFileType(ext: string): string {
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'].includes(ext)) return 'image'
  if (['.mp3', '.wav', '.flac', '.aac', '.ogg', '.m4a'].includes(ext)) return 'audio'
  if (['.pdf'].includes(ext)) return 'pdf'
  if (['.xlsx', '.xls', '.csv'].includes(ext)) return 'excel'
  if (['.txt'].includes(ext)) return 'text'
  return 'other'
}
