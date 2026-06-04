import { Router, type Request, type Response } from 'express'
import db from '../database.js'

function toCamelCase(log: any): any {
  return {
    id: log.id,
    batchId: log.batch_id,
    operator: log.operator,
    totalRows: log.total_rows,
    newRows: log.new_rows,
    skippedRows: log.skipped_rows,
    conflictRows: log.conflict_rows,
    createdAt: log.created_at,
  }
}

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const logs = db.prepare('SELECT * FROM import_logs ORDER BY created_at DESC').all() as any[]
    res.json({ success: true, data: logs.map(toCamelCase) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
