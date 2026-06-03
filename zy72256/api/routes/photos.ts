import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../database.js'
import type { InspectionPhoto } from '../../shared/types.js'

const router = Router()

router.post('/photos', (req: Request, res: Response): void => {
  const { record_id, photo_number, description, attached_by } = req.body as {
    record_id: string
    photo_number: string
    description?: string
    attached_by: string
  }

  const db = getDb()
  const id = uuidv4()

  db.prepare(`
    INSERT INTO inspection_photos (id, record_id, photo_number, description, attached_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, record_id, photo_number, description || null, attached_by)

  const photo = db.prepare('SELECT * FROM inspection_photos WHERE id = ?').get(id) as InspectionPhoto
  res.json({ success: true, data: photo })
})

router.get('/photos/:recordId', (req: Request, res: Response): void => {
  const db = getDb()
  const photos = db.prepare('SELECT * FROM inspection_photos WHERE record_id = ? ORDER BY attached_at ASC').all(req.params.recordId) as InspectionPhoto[]
  res.json({ success: true, data: photos })
})

export default router
