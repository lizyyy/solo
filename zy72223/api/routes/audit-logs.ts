import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

function mapAuditLog(row: any) {
  return {
    id: row.id,
    settlementId: row.settlement_id,
    entryId: row.entry_id,
    action: row.action,
    operator: row.operator,
    detail: row.detail,
    command: row.command,
    createdAt: row.created_at,
  }
}

router.get('/', (req: Request, res: Response): void => {
  const { settlementId } = req.query
  let rows: any[]

  if (settlementId) {
    rows = db.prepare(`SELECT * FROM audit_logs WHERE settlement_id = ? ORDER BY created_at DESC`).all(settlementId)
  } else {
    rows = db.prepare(`SELECT * FROM audit_logs ORDER BY created_at DESC`).all()
  }

  res.json({ success: true, data: rows.map(mapAuditLog) })
})

router.get('/:id/command', (req: Request, res: Response): void => {
  const log = db.prepare(`SELECT * FROM audit_logs WHERE id = ?`).get(req.params.id) as any

  if (!log) {
    res.status(404).json({ success: false, error: 'Audit log not found' })
    return
  }

  res.json({ success: true, data: { command: log.command } })
})

export default router
