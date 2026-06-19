import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

interface ParamEntryRow {
  id: string
  key: string
  value: number
  description: string
  updated_at: string
  updated_by: string
}

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const params = db.prepare('SELECT * FROM param_entries ORDER BY id').all() as ParamEntryRow[]
    res.json({ success: true, data: params })
  } catch (error) {
    console.error('查询参数失败:', error)
    res.status(500).json({ success: false, error: '查询参数失败' })
  }
})

router.put('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { value, description, changedBy, operatorRole } = req.body

    const param = db.prepare('SELECT * FROM param_entries WHERE id = ?').get(id) as ParamEntryRow | undefined
    if (!param) {
      res.status(404).json({ success: false, error: '参数不存在' })
      return
    }

    if (value !== undefined && (value < 0 || value > 999999)) {
      res.status(400).json({ success: false, error: '参数值超出合理范围（0 ~ 999999），请检查后重新输入' })
      return
    }

    const oldValue = param.value
    const oldDescription = param.description
    const newValue = value !== undefined ? value : oldValue
    const newDescription = description !== undefined ? description : oldDescription
    const operator = changedBy || 'system'
    const role = operatorRole || 'system'

    const transaction = db.transaction((): void => {
      db.prepare("UPDATE param_entries SET value = ?, description = ?, updated_at = datetime('now'), updated_by = ? WHERE id = ?").run(newValue, newDescription, operator, id)

      if (newValue !== oldValue) {
        const changeId = uuidv4()
        db.prepare('INSERT INTO param_change_records (id, param_id, field, old_value, new_value, changed_by, change_type) VALUES (?, ?, ?, ?, ?, ?, ?)').run(changeId, id, 'value', String(oldValue), String(newValue), operator, 'value')
        db.prepare('INSERT INTO change_log (id, entity_type, entity_id, action, field, old_value, new_value, operator, operator_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), 'param', id, 'update', 'value', String(oldValue), String(newValue), operator, role)
      }

      if (newDescription !== oldDescription) {
        const remarkChangeId = uuidv4()
        const isOnlyRemark = newValue === oldValue
        db.prepare('INSERT INTO param_change_records (id, param_id, field, old_value, new_value, changed_by, change_type) VALUES (?, ?, ?, ?, ?, ?, ?)').run(remarkChangeId, id, 'description', oldDescription, newDescription, operator, isOnlyRemark ? 'remark' : 'value')
        db.prepare('INSERT INTO change_log (id, entity_type, entity_id, action, field, old_value, new_value, operator, operator_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(uuidv4(), 'param', id, 'update', 'description', oldDescription, newDescription, operator, role)
      }
    })

    transaction()

    const updatedParam = db.prepare('SELECT * FROM param_entries WHERE id = ?').get(id) as ParamEntryRow
    const latestChange = db.prepare('SELECT * FROM param_change_records WHERE param_id = ? ORDER BY changed_at DESC LIMIT 1').get(id) as Record<string, unknown> | undefined

    res.json({ success: true, data: { param: updatedParam, changeRecord: latestChange } })
  } catch (error) {
    console.error('更新参数失败:', error)
    res.status(500).json({ success: false, error: '更新参数失败' })
  }
})

router.get('/history', (req: Request, res: Response): void => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 10
    const offset = (page - 1) * pageSize

    const total = db.prepare('SELECT COUNT(*) as count FROM param_change_records').get() as { count: number }
    const history = db.prepare('SELECT * FROM param_change_records ORDER BY changed_at DESC LIMIT ? OFFSET ?').all(pageSize, offset) as Record<string, unknown>[]

    res.json({
      success: true,
      data: {
        items: history,
        total: total.count,
        page,
        pageSize
      }
    })
  } catch (error) {
    console.error('查询历史失败:', error)
    res.status(500).json({ success: false, error: '查询参数变更历史失败' })
  }
})

export default router
