import { Router, type Request, type Response } from 'express'
import { getDb } from '../db.js'
import { randomUUID } from 'crypto'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM projects ORDER BY created_at DESC').all()
  res.json({ success: true, data: rows })
})

router.post('/', (req: Request, res: Response) => {
  const db = getDb()
  const id = randomUUID()
  const { name, description } = req.body
  if (!name) {
    res.status(400).json({ success: false, error: '项目名称不能为空' })
    return
  }
  db.prepare('INSERT INTO projects (id, name, description) VALUES (?, ?, ?)').run(id, name, description || '')
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id)
  res.json({ success: true, data: row })
})

router.get('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id)
  if (!row) {
    res.status(404).json({ success: false, error: '项目不存在' })
    return
  }
  res.json({ success: true, data: row })
})

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb()
  db.prepare('DELETE FROM estimation_reports WHERE project_id = ?').run(req.params.id)
  db.prepare('DELETE FROM light_records WHERE project_id = ?').run(req.params.id)
  db.prepare('DELETE FROM track_params WHERE project_id = ?').run(req.params.id)
  db.prepare('DELETE FROM car_params WHERE project_id = ?').run(req.params.id)
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
