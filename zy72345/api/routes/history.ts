import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 10
    const offset = (page - 1) * pageSize
    const { entityType, action } = req.query

    let query = 'SELECT * FROM change_log WHERE 1=1'
    const params: (string | number)[] = []

    if (entityType) {
      query += ' AND entity_type = ?'
      params.push(entityType as string)
    }

    if (action) {
      query += ' AND action = ?'
      params.push(action as string)
    }

    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count')
    const total = db.prepare(countQuery).get(...params) as { count: number }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?'
    params.push(pageSize, offset)

    const items = db.prepare(query).all(...params)

    res.json({
      success: true,
      data: {
        items,
        total: total.count,
        page,
        pageSize
      }
    })
  } catch (error) {
    console.error('查询变更历史失败:', error)
    res.status(500).json({ success: false, error: '查询变更历史失败' })
  }
})

router.post('/:id/rollback', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { operator, operatorRole } = req.body

    const entry = db.prepare('SELECT * FROM change_log WHERE id = ?').get(id) as Record<string, any> | undefined
    if (!entry) {
      res.status(404).json({ success: false, error: '变更记录不存在' })
      return
    }

    if (!entry.can_rollback) {
      res.status(400).json({ success: false, error: '该变更记录不可回滚' })
      return
    }

    const rollbackOperator = operator || 'system'
    const rollbackRole = operatorRole || 'system'

    const transaction = db.transaction(() => {
      if (entry.entity_type === 'param' && entry.field === 'value') {
        db.prepare('UPDATE param_entries SET value = ? WHERE id = ?').run(parseFloat(entry.old_value), entry.entity_id)
      } else if (entry.entity_type === 'param' && entry.field === 'description') {
        db.prepare('UPDATE param_entries SET description = ? WHERE id = ?').run(entry.old_value, entry.entity_id)
      } else if (entry.entity_type === 'boundary_sample' && entry.field === 'status') {
        db.prepare('UPDATE boundary_samples SET status = ? WHERE id = ?').run(entry.old_value, entry.entity_id)
        const sample = db.prepare('SELECT * FROM boundary_samples WHERE id = ?').get(entry.entity_id) as Record<string, any> | undefined
        if (sample) {
          db.prepare('UPDATE sampling_records SET boundary_status = ? WHERE id = ?').run(entry.old_value, sample.record_id)
        }
      }

      db.prepare('UPDATE change_log SET can_rollback = 0 WHERE id = ?').run(id)

      db.prepare('INSERT INTO change_log (id, entity_type, entity_id, action, field, old_value, new_value, operator, operator_role, can_rollback) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)').run(
        uuidv4(), entry.entity_type, entry.entity_id, 'rollback', entry.field, entry.new_value, entry.old_value, rollbackOperator, rollbackRole
      )
    })

    transaction()

    res.json({ success: true, message: '回滚成功' })
  } catch (error) {
    console.error('回滚失败:', error)
    res.status(500).json({ success: false, error: '回滚操作失败' })
  }
})

export default router
