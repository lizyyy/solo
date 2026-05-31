import { Router, type Request, type Response } from 'express'
import { getDb } from '../database.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const db = getDb()
    const conditions: string[] = []
    const params: unknown[] = []

    if (req.query.operationType) {
      conditions.push('operation_type = ?')
      params.push(req.query.operationType)
    }

    if (req.query.dateFrom) {
      conditions.push('created_at >= ?')
      params.push(req.query.dateFrom)
    }

    if (req.query.dateTo) {
      conditions.push('created_at <= ?')
      params.push(req.query.dateTo)
    }

    const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''
    const logs = db.prepare(`SELECT * FROM audit_logs ${where} ORDER BY created_at DESC`).all(...params)

    const mapped = logs.map((row: any) => ({
      id: row.id,
      operationType: row.operation_type,
      operator: row.operator,
      targetFeatureId: row.target_feature_id,
      targetFeatureName: row.target_feature_name,
      beforeValue: row.before_value,
      afterValue: row.after_value,
      reason: row.reason,
      filterSnapshot: row.filter_snapshot,
      createdAt: row.created_at,
    }))

    res.json({ success: true, data: mapped })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

export default router
