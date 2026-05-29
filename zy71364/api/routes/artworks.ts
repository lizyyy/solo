import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../database.js'

const router = Router()

function toCamelCase(row: Record<string, unknown>) {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    result[camel] = row[key]
  }
  return result
}

router.get('/', (req: Request, res: Response): void => {
  const { status, keyword } = req.query
  let sql = 'SELECT * FROM artworks WHERE 1=1'
  const params: unknown[] = []

  if (status) {
    sql += ' AND status = ?'
    params.push(status)
  }
  if (keyword) {
    sql += ' AND (name LIKE ? OR accession_number LIKE ?)'
    params.push(`%${keyword}%`, `%${keyword}%`)
  }

  sql += ' ORDER BY created_at DESC'
  const rows = db.prepare(sql).all(...params) as Record<string, unknown>[]
  res.json({ success: true, data: rows.map(toCamelCase) })
})

router.get('/:id', (req: Request, res: Response): void => {
  const row = db.prepare('SELECT * FROM artworks WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!row) {
    res.status(404).json({ success: false, error: '作品不存在' })
    return
  }
  res.json({ success: true, data: toCamelCase(row) })
})

router.post('/', (req: Request, res: Response): void => {
  const { name, era, material, dimensions, accessionNumber, status } = req.body
  if (!name || !era || !material || !dimensions || !accessionNumber) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }

  const id = uuidv4()
  const now = new Date().toISOString()

  try {
    db.prepare(`
      INSERT INTO artworks (id, name, era, material, dimensions, accession_number, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, era, material, dimensions, accessionNumber, status || 'pending', now, now)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('UNIQUE')) {
      res.status(409).json({ success: false, error: '登录号已存在' })
      return
    }
    throw err
  }

  const row = db.prepare('SELECT * FROM artworks WHERE id = ?').get(id) as Record<string, unknown>
  res.status(201).json({ success: true, data: toCamelCase(row) })
})

router.put('/:id', (req: Request, res: Response): void => {
  const existing = db.prepare('SELECT * FROM artworks WHERE id = ?').get(req.params.id)
  if (!existing) {
    res.status(404).json({ success: false, error: '作品不存在' })
    return
  }

  const { name, era, material, dimensions, accessionNumber, status } = req.body
  const now = new Date().toISOString()

  try {
    db.prepare(`
      UPDATE artworks SET
        name = COALESCE(?, name),
        era = COALESCE(?, era),
        material = COALESCE(?, material),
        dimensions = COALESCE(?, dimensions),
        accession_number = COALESCE(?, accession_number),
        status = COALESCE(?, status),
        updated_at = ?
      WHERE id = ?
    `).run(name, era, material, dimensions, accessionNumber, status, now, req.params.id)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('UNIQUE')) {
      res.status(409).json({ success: false, error: '登录号已存在' })
      return
    }
    throw err
  }

  const row = db.prepare('SELECT * FROM artworks WHERE id = ?').get(req.params.id) as Record<string, unknown>
  res.json({ success: true, data: toCamelCase(row) })
})

export default router
