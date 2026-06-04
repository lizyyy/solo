import { Router, type Request, type Response } from 'express'
import db from '../database.js'

function toCamelCase(change: any): any {
  return {
    id: change.id,
    entityType: change.entity_type,
    entityId: change.entity_id,
    fieldName: change.field_name,
    oldValue: change.old_value,
    newValue: change.new_value,
    reason: change.reason,
    changedBy: change.changed_by,
    affectedResults: JSON.parse(change.affected_results || '[]'),
    createdAt: change.created_at,
  }
}

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const { entityType, entityId } = req.query
    let sql = 'SELECT * FROM change_records WHERE 1=1'
    const params: any[] = []

    if (entityType) {
      sql += ' AND entity_type = ?'
      params.push(entityType)
    }

    if (entityId) {
      sql += ' AND entity_id = ?'
      params.push(entityId)
    }

    sql += ' ORDER BY created_at DESC'
    const rows = db.prepare(sql).all(...params) as any[]
    res.json({ success: true, data: rows.map(toCamelCase) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const change = db.prepare('SELECT * FROM change_records WHERE id = ?').get(req.params.id) as any
    if (!change) {
      res.status(404).json({ success: false, error: 'Change record not found' })
      return
    }
    res.json({ success: true, data: toCamelCase(change) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
