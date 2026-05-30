import { Router, type Request, type Response } from 'express'
import { getDb } from '../db.js'
import { randomUUID } from 'crypto'

const router = Router()

router.get('/', (req: Request, res: Response) => {
  const db = getDb()
  const projectId = req.query.project_id as string
  if (!projectId) {
    res.status(400).json({ success: false, error: 'project_id 必填' })
    return
  }
  const rows = db.prepare('SELECT * FROM light_records WHERE project_id = ? ORDER BY time_slot').all(projectId)
  res.json({ success: true, data: rows })
})

router.post('/', (req: Request, res: Response) => {
  const db = getDb()
  const id = randomUUID()
  const { project_id, time_slot, intensity_wm2, source } = req.body
  if (!project_id || !time_slot || intensity_wm2 === undefined) {
    res.status(400).json({ success: false, error: 'project_id、时间段、光照强度必填' })
    return
  }
  db.prepare('INSERT INTO light_records (id, project_id, time_slot, intensity_wm2, source) VALUES (?, ?, ?, ?, ?)')
    .run(id, project_id, time_slot, intensity_wm2, source || 'manual')
  const row = db.prepare('SELECT * FROM light_records WHERE id = ?').get(id)
  res.json({ success: true, data: row })
})

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const { time_slot, intensity_wm2, source } = req.body
  db.prepare('UPDATE light_records SET time_slot = ?, intensity_wm2 = ?, source = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(time_slot, intensity_wm2, source, req.params.id)
  const row = db.prepare('SELECT * FROM light_records WHERE id = ?').get(req.params.id)
  res.json({ success: true, data: row })
})

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb()
  db.prepare('DELETE FROM light_records WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
