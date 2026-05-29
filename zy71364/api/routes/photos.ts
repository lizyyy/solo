import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import { mkdirSync } from 'fs'
import { join, extname } from 'path'
import { v4 as uuidv4 } from 'uuid'
import db from '../database.js'

const router = Router()

const UPLOAD_DIR = join(process.cwd(), 'uploads')
mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname)
    cb(null, `${uuidv4()}${ext}`)
  },
})

const upload = multer({ storage })

function toCamelCase(row: Record<string, unknown>) {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    result[camel] = row[key]
  }
  return result
}

router.post('/restorations/:id/photos', upload.single('photo'), (req: Request, res: Response): void => {
  const restoration = db.prepare('SELECT id FROM restorations WHERE id = ?').get(req.params.id)
  if (!restoration) {
    res.status(404).json({ success: false, error: '修复记录不存在' })
    return
  }

  const { stepId, phase } = req.body
  const file = req.file

  if (!stepId || !phase || !file) {
    res.status(400).json({ success: false, error: '缺少必填字段（stepId, phase, photo）' })
    return
  }

  const step = db.prepare('SELECT id FROM restoration_steps WHERE id = ? AND restoration_id = ?').get(stepId, req.params.id)
  if (!step) {
    res.status(404).json({ success: false, error: '步骤不存在' })
    return
  }

  const existing = db.prepare('SELECT MAX(version) as max_version FROM photos WHERE step_id = ? AND phase = ?').get(stepId, phase) as { max_version: number | null }
  const version = (existing.max_version ?? 0) + 1

  const id = uuidv4()
  const url = `/uploads/${file.filename}`
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO photos (id, step_id, url, version, phase, uploaded_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, stepId, url, version, phase, now)

  const row = db.prepare('SELECT * FROM photos WHERE id = ?').get(id) as Record<string, unknown>
  res.status(201).json({ success: true, data: toCamelCase(row) })
})

router.get('/restorations/:id/photos', (req: Request, res: Response): void => {
  const restoration = db.prepare('SELECT id FROM restorations WHERE id = ?').get(req.params.id)
  if (!restoration) {
    res.status(404).json({ success: false, error: '修复记录不存在' })
    return
  }

  const rows = db.prepare(`
    SELECT p.* FROM photos p
    JOIN restoration_steps rs ON p.step_id = rs.id
    WHERE rs.restoration_id = ?
    ORDER BY rs.step_order, p.phase, p.version
  `).all(req.params.id) as Record<string, unknown>[]
  res.json({ success: true, data: rows.map(toCamelCase) })
})

router.put('/:id', (req: Request, res: Response): void => {
  const existing = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!existing) {
    res.status(404).json({ success: false, error: '照片不存在' })
    return
  }

  const { phase, stepId } = req.body

  if (phase && phase !== existing.phase) {
    const maxVersion = db.prepare('SELECT MAX(version) as max_version FROM photos WHERE step_id = ? AND phase = ?').get(
      stepId ?? existing.step_id, phase
    ) as { max_version: number | null }
    const version = (maxVersion.max_version ?? 0) + 1
    db.prepare('UPDATE photos SET phase = ?, version = ?, step_id = COALESCE(?, step_id) WHERE id = ?').run(phase, version, stepId, req.params.id)
  } else {
    db.prepare('UPDATE photos SET step_id = COALESCE(?, step_id) WHERE id = ?').run(stepId, req.params.id)
  }

  const row = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id) as Record<string, unknown>
  res.json({ success: true, data: toCamelCase(row) })
})

router.delete('/:id', (req: Request, res: Response): void => {
  const existing = db.prepare('SELECT * FROM photos WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!existing) {
    res.status(404).json({ success: false, error: '照片不存在' })
    return
  }

  db.prepare('DELETE FROM photos WHERE id = ?').run(req.params.id)
  res.json({ success: true, data: null })
})

export default router
