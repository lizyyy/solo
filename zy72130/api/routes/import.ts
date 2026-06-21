import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import multer from 'multer'
import * as xlsx from 'xlsx'
import fs from 'fs'
import { getDb } from '../db.js'
import { saveAttachment, getFileType, ensureAttachmentsDir } from '../lib/attachments.js'

ensureAttachmentsDir()

const upload = multer({ dest: 'uploads/' })

const router = Router()

interface RecordRow {
  id: string
  track_name: string
  artist: string
  revenue: number
  share_ratio: number | null
  share_amount: number | null
  status: string
  source: string
  original_note: string
  current_note: string
  attachments: string
  created_at: string
  updated_at: string
}

function rowToApi(row: RecordRow) {
  return {
    id: row.id,
    trackName: row.track_name,
    artist: row.artist,
    revenue: row.revenue,
    shareRatio: row.share_ratio,
    shareAmount: row.share_amount,
    status: row.status,
    source: row.source,
    originalNote: row.original_note,
    currentNote: row.current_note,
    attachments: JSON.parse(row.attachments || '[]'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function parseExcelFile(filePath: string): { trackName: string; artist: string; revenue: number; shareRatio: number | null; note: string }[] {
  const wb = xlsx.readFile(filePath)
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(ws)

  return rows.map((row) => {
    const trackName = String(row['曲目'] || row['曲目名'] || row['track'] || row['trackName'] || '')
    const artist = String(row['演出者'] || row['艺术家'] || row['artist'] || '')
    const revenue = Number(row['票房收入'] || row['票房'] || row['revenue'] || 0)
    const shareRatioVal = row['分账比例'] || row['比例'] || row['shareRatio'] || null
    const shareRatio = shareRatioVal != null ? Number(shareRatioVal) : null
    const note = String(row['备注'] || row['note'] || row['原始备注'] || '')

    return { trackName, artist, revenue, shareRatio, note }
  }).filter(r => r.trackName)
}

function determineStatus(shareRatio: number | null, note: string): { status: 'smooth' | 'needs_confirmation' | 'old_standard'; description: string; result: string } {
  if (shareRatio != null && note.includes('老规矩')) {
    return {
      status: 'old_standard',
      description: '来自旧Excel，检测到备注含旧口径标识',
      result: `备注"${note}"含旧口径标识，标记为旧口径`,
    }
  }

  if (shareRatio == null) {
    return {
      status: 'needs_confirmation',
      description: '系统未找到合同分账比例',
      result: '分账比例缺失，状态标记为待确认',
    }
  }

  return {
    status: 'smooth',
    description: '系统匹配到合同分账比例',
    result: `分账比例${(shareRatio * 100).toFixed(0)}%，状态标记为顺利`,
  }
}

router.post('/', upload.array('files', 50), (req: Request, res: Response) => {
  const db = getDb()
  const files = req.files as Express.Multer.File[] | undefined

  if (!files || files.length === 0) {
    res.status(400).json({ error: '未上传文件' })
    return
  }

  const failedFiles: { fileName: string; reason: string }[] = []
  const importedRecords: unknown[] = []
  let successCount = 0

  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '')

  for (const file of files) {
    try {
      const ext = file.originalname?.toLowerCase().split('.').pop() || ''
      const fullExt = `.${ext}`
      const fileName = file.originalname || 'unknown'

      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
        const parsed = parseExcelFile(file.path)

        for (const item of parsed) {
          const recordId = uuidv4()
          const attachmentId = uuidv4()
          const attachment = saveAttachment(file.path, fileName, attachmentId)
          const attachmentsJson = JSON.stringify([attachment])
          const judgment = determineStatus(item.shareRatio, item.note)
          const shareAmount = item.shareRatio != null ? Math.round(item.revenue * item.shareRatio) : null

          db.prepare(`
            INSERT INTO records (id, track_name, artist, revenue, share_ratio, share_amount, status, source, original_note, current_note, attachments, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(recordId, item.trackName, item.artist, item.revenue, item.shareRatio, shareAmount, judgment.status, 'excel', item.note, item.note, attachmentsJson, now, now)

          db.prepare(`
            INSERT INTO judgment_logs (id, record_id, step, type, description, result, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(uuidv4(), recordId, 1, 'system_auto', judgment.description, judgment.result, now)

          const record = db.prepare('SELECT * FROM records WHERE id = ?').get(recordId)
          importedRecords.push(rowToApi(record as RecordRow))
          successCount++
        }
      } else if (ext === 'mp3' || ext === 'wav' || ext === 'flac' || ext === 'aac' || ext === 'ogg' || ext === 'm4a') {
        const recordId = uuidv4()
        const attachmentId = uuidv4()
        const attachment = saveAttachment(file.path, fileName, attachmentId)
        const attachmentsJson = JSON.stringify([attachment])
        const trackName = fileName.replace(/\.[^.]+$/, '')

        db.prepare(`
          INSERT INTO records (id, track_name, artist, revenue, share_ratio, share_amount, status, source, original_note, current_note, attachments, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(recordId, trackName, '待补充', 0, null, null, 'needs_confirmation', 'audio', `音频文件：${fileName}`, `音频文件：${fileName}`, attachmentsJson, now, now)

        db.prepare(`
          INSERT INTO judgment_logs (id, record_id, step, type, description, result, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), recordId, 1, 'system_auto', '音频文件导入，缺少分账信息', '标记为待确认，需人工补充分账比例', now)

        const record = db.prepare('SELECT * FROM records WHERE id = ?').get(recordId)
        importedRecords.push(rowToApi(record as RecordRow))
        successCount++
      } else if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'pdf'].includes(ext)) {
        const recordId = uuidv4()
        const attachmentId = uuidv4()
        const attachment = saveAttachment(file.path, fileName, attachmentId)
        const attachmentsJson = JSON.stringify([attachment])
        const isImage = getFileType(fullExt) === 'image'
        const label = isImage ? '合同截图' : '合同文件'

        db.prepare(`
          INSERT INTO records (id, track_name, artist, revenue, share_ratio, share_amount, status, source, original_note, current_note, attachments, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(recordId, label, '待补充', 0, null, null, 'needs_confirmation', 'contract', `${label}：${fileName}`, `${label}：${fileName}`, attachmentsJson, now, now)

        db.prepare(`
          INSERT INTO judgment_logs (id, record_id, step, type, description, result, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), recordId, 1, 'system_auto', `${label}导入，缺少分账信息`, '标记为待确认，需人工提取合同内容', now)

        const record = db.prepare('SELECT * FROM records WHERE id = ?').get(recordId)
        importedRecords.push(rowToApi(record as RecordRow))
        successCount++
      } else if (ext === 'txt') {
        const recordId = uuidv4()
        const attachmentId = uuidv4()
        const attachment = saveAttachment(file.path, fileName, attachmentId)
        const attachmentsJson = JSON.stringify([attachment])
        const content = fs.readFileSync(file.path, 'utf-8').trim()
        const lines = content.split(/\r?\n/).filter(l => l.trim())
        const firstLine = lines[0] || fileName
        const trackName = firstLine.length > 50 ? firstLine.slice(0, 50) + '…' : firstLine
        const note = lines.length > 1 ? lines.slice(1).join('；') : `群聊批注：${fileName}`
        const judgment = determineStatus(null, note)

        db.prepare(`
          INSERT INTO records (id, track_name, artist, revenue, share_ratio, share_amount, status, source, original_note, current_note, attachments, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(recordId, trackName, '待补充', 0, null, null, judgment.status, 'chat_annotation', note, note, attachmentsJson, now, now)

        db.prepare(`
          INSERT INTO judgment_logs (id, record_id, step, type, description, result, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(uuidv4(), recordId, 1, 'system_auto', judgment.description, judgment.result, now)

        const record = db.prepare('SELECT * FROM records WHERE id = ?').get(recordId)
        importedRecords.push(rowToApi(record as RecordRow))
        successCount++
      } else {
        failedFiles.push({ fileName, reason: `不支持的文件格式：${ext}` })
      }
    } catch (err) {
      failedFiles.push({
        fileName: file.originalname || 'unknown',
        reason: err instanceof Error ? err.message : '解析失败',
      })
    }
  }

  const batchId = uuidv4()
  db.prepare(`
    INSERT INTO import_batches (id, total_files, success_count, fail_count, failed_files)
    VALUES (?, ?, ?, ?, ?)
  `).run(batchId, files.length, successCount, failedFiles.length, JSON.stringify(failedFiles))

  res.json({
    totalFiles: files.length,
    successCount,
    failCount: failedFiles.length,
    failedFiles,
    importedRecords,
  })
})

export default router
