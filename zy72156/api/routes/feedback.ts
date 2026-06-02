import express, { type Request, type Response } from 'express'
import { getDb } from '../db/index.js'
import { v4 as uuidv4 } from 'uuid'

const router = express.Router()
const db = getDb()

function serializeRow(row: any): any {
  return {
    ...row,
    is_duplicate: row.is_duplicate === 1,
    is_boundary: row.is_boundary === 1
  }
}

router.get('/', (req: Request, res: Response) => {
  const { location_id, is_duplicate, is_boundary } = req.query

  let sql = 'SELECT * FROM feedback WHERE 1=1'
  const params: any[] = []

  if (location_id) {
    sql += ' AND location_id = ?'
    params.push(location_id)
  }

  if (is_duplicate === 'true') {
    sql += ' AND is_duplicate = 1'
  } else if (is_duplicate === 'false') {
    sql += ' AND is_duplicate = 0'
  }

  if (is_boundary === 'true') {
    sql += ' AND is_boundary = 1'
  } else if (is_boundary === 'false') {
    sql += ' AND is_boundary = 0'
  }

  sql += ' ORDER BY reported_at DESC'

  const rows = db.prepare(sql).all(...params) as any[]
  res.json({ success: true, data: rows.map(serializeRow) })
})

router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params

  const feedback = db.prepare('SELECT * FROM feedback WHERE id = ?').get(id) as any
  if (!feedback) {
    return res.status(404).json({ success: false, error: '反馈记录不存在' })
  }

  const location = db.prepare('SELECT id, canonical_name, lat, lng FROM locations WHERE id = ?').get(feedback.location_id)

  const duplicates = db.prepare(`
    SELECT * FROM feedback WHERE duplicate_of = ? OR id = ?
  `).all(id, feedback.duplicate_of) as any[]

  const notes = db.prepare(`
    SELECT * FROM manual_notes
    WHERE target_type = ? AND target_id = ?
    ORDER BY created_at DESC
  `).all('feedback', id) as any[]

  res.json({
    success: true,
    data: {
      ...serializeRow(feedback),
      location,
      related_duplicates: duplicates.map(serializeRow),
      notes
    }
  })
})

router.post('/', (req: Request, res: Response) => {
  const { location_id, raw_location_text, content, source, source_type, reported_at, is_duplicate = false, duplicate_of = null, is_boundary = false, boundary_note = null } = req.body

  if (!location_id || !raw_location_text || !source || !source_type || !reported_at) {
    return res.status(400).json({ success: false, error: '必填项缺失' })
  }

  const validTypes = ['居民投诉', '网格巡查', '12345工单', '现场走访']
  if (!validTypes.includes(source_type)) {
    return res.status(400).json({ success: false, error: '无效的来源类型' })
  }

  const id = `fb-${uuidv4().slice(0, 8)}`
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  db.prepare(`
    INSERT INTO feedback (id, location_id, raw_location_text, content, source, source_type, is_duplicate, duplicate_of, is_boundary, boundary_note, reported_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, location_id, raw_location_text, content || '', source, source_type, is_duplicate ? 1 : 0, duplicate_of, is_boundary ? 1 : 0, boundary_note, reported_at, now)

  const created = db.prepare('SELECT * FROM feedback WHERE id = ?').get(id)
  res.json({ success: true, data: serializeRow(created) })
})

router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const { is_duplicate, duplicate_of, is_boundary, boundary_note, content, source, source_type } = req.body

  const existing = db.prepare('SELECT * FROM feedback WHERE id = ?').get(id)
  if (!existing) {
    return res.status(404).json({ success: false, error: '反馈记录不存在' })
  }

  db.prepare(`
    UPDATE feedback
    SET is_duplicate = COALESCE(?, is_duplicate),
        duplicate_of = ?,
        is_boundary = COALESCE(?, is_boundary),
        boundary_note = ?,
        content = COALESCE(?, content),
        source = COALESCE(?, source),
        source_type = COALESCE(?, source_type)
    WHERE id = ?
  `).run(
    is_duplicate != null ? (is_duplicate ? 1 : 0) : null,
    duplicate_of,
    is_boundary != null ? (is_boundary ? 1 : 0) : null,
    boundary_note,
    content,
    source,
    source_type,
    id
  )

  const updated = db.prepare('SELECT * FROM feedback WHERE id = ?').get(id)
  res.json({ success: true, data: serializeRow(updated) })
})

export default router
