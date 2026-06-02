import { Router, type Request, type Response } from 'express'
import { getAuditLogsByBatch } from '../repositories/audit-log.repo.js'

const router = Router()

router.get('/:batchId/audit-logs', (req: Request, res: Response): void => {
  try {
    const logs = getAuditLogsByBatch(req.params.batchId)
    res.json({ success: true, data: logs })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
