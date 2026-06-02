import express, { type Request, type Response } from 'express'
import { getDb } from '../db/index.js'
import { v4 as uuidv4 } from 'uuid'

const router = express.Router()
const db = getDb()

router.get('/', (req: Request, res: Response) => {
  const { target_type, target_id } = req.query

  let sql = 'SELECT * FROM manual_notes WHERE 1=1'
  const params: any[] = []

  if (target_type) {
    sql += ' AND target_type = ?'
    params.push(target_type)
  }

  if (target_id) {
    sql += ' AND target_id = ?'
    params.push(target_id)
  }

  sql += ' ORDER BY created_at DESC'

  const rows = db.prepare(sql).all(...params)
  res.json({ success: true, data: rows })
})

router.post('/', (req: Request, res: Response) => {
  const { target_type, target_id, content, created_by = '老曹' } = req.body

  if (!target_type || !target_id || !content) {
    return res.status(400).json({ success: false, error: '必填项缺失' })
  }

  const validTypes = ['location', 'feedback', 'scheme', 'report']
  if (!validTypes.includes(target_type)) {
    return res.status(400).json({ success: false, error: '无效的目标类型' })
  }

  const id = `note-${uuidv4().slice(0, 8)}`
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)

  db.prepare(`
    INSERT INTO manual_notes (id, target_type, target_id, content, created_at, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, target_type, target_id, content, now, created_by)

  const created = db.prepare('SELECT * FROM manual_notes WHERE id = ?').get(id)
  res.json({ success: true, data: created })
})

router.delete('/:id', (req: Request, res: Response) => {
  const { id } = req.params

  const existing = db.prepare('SELECT * FROM manual_notes WHERE id = ?').get(id)
  if (!existing) {
    return res.status(404).json({ success: false, error: '备注不存在' })
  }

  db.prepare('DELETE FROM manual_notes WHERE id = ?').run(id)
  res.json({ success: true, data: { id } })
})

export default router
