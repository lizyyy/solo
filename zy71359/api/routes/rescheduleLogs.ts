import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  try {
    const logs = db.prepare(`
      SELECT rl.*, w.name AS work_name,
        fb.name AS from_batch_name, tb.name AS to_batch_name
      FROM reschedule_logs rl
      LEFT JOIN works w ON w.id = rl.work_id
      LEFT JOIN batches fb ON fb.id = rl.from_batch_id
      LEFT JOIN batches tb ON tb.id = rl.to_batch_id
      ORDER BY rl.created_at DESC
    `).all()
    res.json({ success: true, data: logs })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/:workId', (req: Request, res: Response) => {
  try {
    const work = db.prepare('SELECT * FROM works WHERE id = ?').get(req.params.workId)
    if (!work) {
      res.status(404).json({ success: false, error: '作品不存在' })
      return
    }
    const logs = db.prepare(`
      SELECT rl.*, fb.name AS from_batch_name, tb.name AS to_batch_name
      FROM reschedule_logs rl
      LEFT JOIN batches fb ON fb.id = rl.from_batch_id
      LEFT JOIN batches tb ON tb.id = rl.to_batch_id
      WHERE rl.work_id = ?
      ORDER BY rl.created_at DESC
    `).all(req.params.workId)
    res.json({ success: true, data: logs })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
