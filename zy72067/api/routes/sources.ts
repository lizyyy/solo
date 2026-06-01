import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../database.js'

const router = Router({ mergeParams: true })

router.get('/', (req: Request, res: Response) => {
  const { recordId } = req.params
  const record = db.prepare('SELECT * FROM hot_spot_records WHERE id = ?').get(recordId)
  if (!record) {
    res.status(404).json({ success: false, error: '记录不存在' })
    return
  }
  const sources = db.prepare('SELECT * FROM source_attachments WHERE record_id = ? ORDER BY imported_at ASC').all(recordId)
  res.json({ success: true, data: sources })
})

router.post('/', (req: Request, res: Response) => {
  const { recordId } = req.params
  const record = db.prepare('SELECT * FROM hot_spot_records WHERE id = ?').get(recordId)
  if (!record) {
    res.status(404).json({ success: false, error: '记录不存在' })
    return
  }

  const { source_type, source_ref, source_name, description, raw_data } = req.body
  if (!source_type || !source_ref || !source_name) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }

  const id = uuidv4()
  db.prepare(`
    INSERT INTO source_attachments (id, record_id, source_type, source_ref, source_name, description, raw_data)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, recordId, source_type, source_ref, source_name, description || null, raw_data || null)

  const source = db.prepare('SELECT * FROM source_attachments WHERE id = ?').get(id)
  res.status(201).json({ success: true, data: source })
})

export default router
