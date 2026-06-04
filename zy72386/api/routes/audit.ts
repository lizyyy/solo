import { Router, type Request, type Response } from 'express'
import { getDb } from '../db.js'

const router = Router()

router.get('/record/:recordId', (req: Request, res: Response): void => {
  try {
    const db = getDb()
    const { recordId } = req.params

    const logs = db.prepare(
      'SELECT * FROM audit_log WHERE record_id = ? ORDER BY timestamp ASC'
    ).all(recordId)

    res.json({ success: true, data: logs })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.get('/batch/:importId', (req: Request, res: Response): void => {
  try {
    const db = getDb()
    const { importId } = req.params

    const logs = db.prepare(
      'SELECT * FROM audit_log WHERE import_id = ? ORDER BY timestamp ASC'
    ).all(importId)

    res.json({ success: true, data: logs })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

export default router
