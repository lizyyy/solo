import { Router, type Request, type Response } from 'express'
import { getDb } from '../database.js'
import { getAuditLogs, rollbackToSnapshot } from '../services/auditService.js'
import type { RollbackRequest } from '../../shared/types.js'

const router = Router()

router.get('/audit', (_req: Request, res: Response): void => {
  const db = getDb()
  const logs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10').all()
  res.json({ success: true, data: logs })
})

router.get('/audit/:recordId', (req: Request, res: Response): void => {
  const logs = getAuditLogs(req.params.recordId)
  res.json({ success: true, data: logs })
})

router.post('/rollback', (req: Request, res: Response): void => {
  const body = req.body as RollbackRequest & { operator_role: string }

  if (body.operator_role !== 'inspector') {
    res.status(403).json({ success: false, error: 'Only inspector role can perform rollback' })
    return
  }

  try {
    const updated = rollbackToSnapshot(body.record_id, body.target_audit_log_id, body.operator, body.reason)
    res.json({ success: true, data: updated })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Rollback failed'
    res.status(400).json({ success: false, error: message })
  }
})

export default router
