import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const { status, source, keyword } = req.query

  let sql = 'SELECT * FROM schedule WHERE 1=1'
  const params: unknown[] = []

  if (status && typeof status === 'string') {
    sql += ' AND status = ?'
    params.push(status)
  }
  if (source && typeof source === 'string') {
    sql += ' AND source = ?'
    params.push(source)
  }
  if (keyword && typeof keyword === 'string') {
    sql += ' AND (part_no LIKE ? OR track_name LIKE ? OR file_name LIKE ? OR remark LIKE ?)'
    const like = `%${keyword}%`
    params.push(like, like, like, like)
  }

  sql += ' ORDER BY id ASC'

  const rows = db.prepare(sql).all(...params)
  res.json({ success: true, data: rows })
})

router.get('/:id', (req: Request, res: Response) => {
  const row = db.prepare('SELECT * FROM schedule WHERE id = ?').get(req.params.id)
  if (!row) {
    res.status(404).json({ success: false, error: '记录不存在' })
    return
  }
  res.json({ success: true, data: row })
})

router.post('/', (req: Request, res: Response) => {
  const { part_no, track_name, file_name, source, version, status, remark, original_source, modified_by } = req.body

  if (!part_no || !source || !original_source) {
    res.status(400).json({ success: false, error: 'part_no、source、original_source 为必填项' })
    return
  }

  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  const result = db.prepare(`
    INSERT INTO schedule (part_no, track_name, file_name, source, version, status, remark, original_source, processed_at, modified_by, modified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(part_no, track_name || null, file_name || null, source, version || 1, status || 'pending', remark || '', original_source, now, modified_by || '', now)

  db.prepare(`
    INSERT INTO audit_log (schedule_id, field, old_value, new_value, operator, operated_at)
    VALUES (?, '创建', '', ?, ?, ?)
  `).run(result.lastInsertRowid, `${part_no} ${track_name || ''}`, modified_by || '未知', now)

  const row = db.prepare('SELECT * FROM schedule WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json({ success: true, data: row })
})

router.patch('/:id', (req: Request, res: Response) => {
  const id = req.params.id
  const existing = db.prepare('SELECT * FROM schedule WHERE id = ?').get(id) as Record<string, unknown> | undefined
  if (!existing) {
    res.status(404).json({ success: false, error: '记录不存在' })
    return
  }

  const { remark, status, modified_by } = req.body
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  const operator = modified_by || '未知'

  const updates: string[] = []
  const values: unknown[] = []

  const insertAudit = db.prepare(`
    INSERT INTO audit_log (schedule_id, field, old_value, new_value, operator, operated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `)

  const transaction = db.transaction(() => {
    if (remark !== undefined && remark !== existing.remark) {
      updates.push('remark = ?')
      values.push(remark)
      insertAudit.run(id, '备注', String(existing.remark || ''), String(remark), operator, now)
    }
    if (status !== undefined && status !== existing.status) {
      updates.push('status = ?')
      values.push(status)
      insertAudit.run(id, '状态', String(existing.status), String(status), operator, now)
    }

    if (updates.length > 0) {
      updates.push('modified_by = ?', 'modified_at = ?')
      values.push(operator, now)
      values.push(id)
      db.prepare(`UPDATE schedule SET ${updates.join(', ')} WHERE id = ?`).run(...values)
    }
  })

  transaction()

  const row = db.prepare('SELECT * FROM schedule WHERE id = ?').get(id)
  res.json({ success: true, data: row })
})

router.delete('/:id', (req: Request, res: Response) => {
  const existing = db.prepare('SELECT * FROM schedule WHERE id = ?').get(req.params.id)
  if (!existing) {
    res.status(404).json({ success: false, error: '记录不存在' })
    return
  }
  db.prepare('DELETE FROM schedule WHERE id = ?').run(req.params.id)
  res.json({ success: true, message: '已删除' })
})

router.get('/:id/audit-logs', (req: Request, res: Response) => {
  const rows = db.prepare('SELECT * FROM audit_log WHERE schedule_id = ? ORDER BY operated_at DESC').all(req.params.id)
  res.json({ success: true, data: rows })
})

export default router
