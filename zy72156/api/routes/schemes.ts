import express, { type Request, type Response } from 'express'
import { getDb } from '../db/index.js'
import { v4 as uuidv4 } from 'uuid'

const router = express.Router()
const db = getDb()

function parseJsonSafe(str: string | null): any {
  if (!str) return null
  try {
    return JSON.parse(str)
  } catch {
    return str
  }
}

function serializeRow(row: any): any {
  return {
    ...row,
    source_refs: parseJsonSafe(row.source_refs)
  }
}

router.get('/', (req: Request, res: Response) => {
  const { location_id, status } = req.query

  let sql = 'SELECT * FROM schemes WHERE 1=1'
  const params: any[] = []

  if (location_id) {
    sql += ' AND location_id = ?'
    params.push(location_id)
  }

  if (status) {
    sql += ' AND status = ?'
    params.push(status)
  }

  sql += ' ORDER BY location_id, version DESC'

  const rows = db.prepare(sql).all(...params) as any[]
  res.json({ success: true, data: rows.map(serializeRow) })
})

router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params

  const scheme = db.prepare('SELECT * FROM schemes WHERE id = ?').get(id) as any
  if (!scheme) {
    return res.status(404).json({ success: false, error: '方案不存在' })
  }

  const location = db.prepare('SELECT id, canonical_name FROM locations WHERE id = ?').get(scheme.location_id)

  const prevScheme = db.prepare(`
    SELECT * FROM schemes
    WHERE location_id = ? AND version = ?
  `).get(scheme.location_id, scheme.version - 1)

  const nextScheme = db.prepare(`
    SELECT * FROM schemes
    WHERE location_id = ? AND version = ?
  `).get(scheme.location_id, scheme.version + 1)

  const notes = db.prepare(`
    SELECT * FROM manual_notes
    WHERE target_type = ? AND target_id = ?
    ORDER BY created_at DESC
  `).all('scheme', id) as any[]

  res.json({
    success: true,
    data: {
      ...serializeRow(scheme),
      location,
      prev_version: prevScheme ? serializeRow(prevScheme) : null,
      next_version: nextScheme ? serializeRow(nextScheme) : null,
      notes
    }
  })
})

router.post('/', (req: Request, res: Response) => {
  const { location_id, title, content, status = '草稿', source_refs = [], created_by = '老曹' } = req.body

  if (!location_id || !title || !content) {
    return res.status(400).json({ success: false, error: '必填项缺失' })
  }

  const maxVersionRow = db.prepare(`
    SELECT MAX(version) as max_v FROM schemes WHERE location_id = ?
  `).get(location_id) as { max_v: number | null }

  const version = (maxVersionRow.max_v || 0) + 1

  const id = `sc-${uuidv4().slice(0, 8)}`
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  db.prepare(`
    INSERT INTO schemes (id, location_id, version, title, content, status, source_refs, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, location_id, version, title, content, status, JSON.stringify(source_refs), now, created_by)

  const created = db.prepare('SELECT * FROM schemes WHERE id = ?').get(id)
  res.json({ success: true, data: serializeRow(created) })
})

router.put('/:id', (req: Request, res: Response) => {
  const { id } = req.params
  const { title, content, status, manual_note, source_refs } = req.body

  const existing = db.prepare('SELECT * FROM schemes WHERE id = ?').get(id)
  if (!existing) {
    return res.status(404).json({ success: false, error: '方案不存在' })
  }

  db.prepare(`
    UPDATE schemes
    SET title = COALESCE(?, title),
        content = COALESCE(?, content),
        status = COALESCE(?, status),
        manual_note = ?,
        source_refs = COALESCE(?, source_refs)
    WHERE id = ?
  `).run(
    title,
    content,
    status,
    manual_note,
    source_refs ? JSON.stringify(source_refs) : null,
    id
  )

  const updated = db.prepare('SELECT * FROM schemes WHERE id = ?').get(id)
  res.json({ success: true, data: serializeRow(updated) })
})

router.post('/:id/supersede', (req: Request, res: Response) => {
  const { id } = req.params
  const { new_title, new_content, historical_opinion, created_by = '老曹' } = req.body

  const oldScheme = db.prepare('SELECT * FROM schemes WHERE id = ?').get(id) as any
  if (!oldScheme) {
    return res.status(404).json({ success: false, error: '旧方案不存在' })
  }

  const newVersion = oldScheme.version + 1
  const newId = `sc-${uuidv4().slice(0, 8)}`
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  db.prepare(`
    INSERT INTO schemes (id, location_id, version, title, content, status, source_refs, historical_opinion, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newId,
    oldScheme.location_id,
    newVersion,
    new_title || `${oldScheme.title.replace(/v\d+$/, '')}v${newVersion}`,
    new_content,
    '已发布',
    oldScheme.source_refs,
    historical_opinion || '',
    now,
    created_by
  )

  db.prepare(`
    UPDATE schemes
    SET status = '被覆盖', superseded_by = ?, historical_opinion = ?
    WHERE id = ?
  `).run(newId, historical_opinion || oldScheme.historical_opinion, id)

  const created = db.prepare('SELECT * FROM schemes WHERE id = ?').get(newId)
  res.json({ success: true, data: serializeRow(created) })
})

export default router
