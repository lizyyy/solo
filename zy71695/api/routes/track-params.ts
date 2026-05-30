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
  const rows = db.prepare('SELECT * FROM track_params WHERE project_id = ? ORDER BY created_at DESC').all(projectId)
  res.json({ success: true, data: rows })
})

router.post('/', (req: Request, res: Response) => {
  const db = getDb()
  const id = randomUUID()
  const { project_id, slope_percent, slope_direction, gear_ratio, track_length_m, surface_type } = req.body
  if (!project_id) {
    res.status(400).json({ success: false, error: 'project_id 必填' })
    return
  }
  db.prepare('INSERT INTO track_params (id, project_id, slope_percent, slope_direction, gear_ratio, track_length_m, surface_type) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, project_id, slope_percent ?? 0, slope_direction ?? 'flat', gear_ratio ?? 1, track_length_m ?? 10, surface_type ?? 'smooth')
  const row = db.prepare('SELECT * FROM track_params WHERE id = ?').get(id)
  res.json({ success: true, data: row })
})

router.put('/:id', (req: Request, res: Response) => {
  const db = getDb()
  const { slope_percent, slope_direction, gear_ratio, track_length_m, surface_type } = req.body
  db.prepare('UPDATE track_params SET slope_percent = ?, slope_direction = ?, gear_ratio = ?, track_length_m = ?, surface_type = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .run(slope_percent, slope_direction, gear_ratio, track_length_m, surface_type, req.params.id)
  const row = db.prepare('SELECT * FROM track_params WHERE id = ?').get(req.params.id)
  res.json({ success: true, data: row })
})

router.delete('/:id', (req: Request, res: Response) => {
  const db = getDb()
  db.prepare('DELETE FROM track_params WHERE id = ?').run(req.params.id)
  res.json({ success: true })
})

export default router
