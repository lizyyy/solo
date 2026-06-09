import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

function generateHumanReadable(entry: any): string {
  const et = entry.entity_type
  const act = entry.action
  const f = entry.field
  const ov = entry.old_value
  const nv = entry.new_value

  if (et === 'param') {
    if (act === 'value' || f === 'value') return `将参数值从 ${ov} 修改为 ${nv}`
    if (f === 'description') return `将参数描述从 "${ov}" 修改为 "${nv}"`
    return `参数变更`
  }
  if (et === 'boundary_sample') {
    if (act === 'update_status') return `将边界样本状态从 ${ov} 回滚到 ${nv}`
    if (act === 'add_review') return `添加复核意见：${nv}`
    return `边界样本操作`
  }
  if (et === 'sampling_record') {
    if (act === 'update_remark') return `将备注从 "${ov}" 修改为 "${nv}"`
    if (act === 'correct_value') return `将原始值从 ${ov} 修正为 ${nv}`
    if (act === 'boundary_detected') return `检测到边界样本`
    return `抽样记录变更`
  }
  if (et === 'sampling_list') {
    if (act === 'import') return `导入抽样名单，记录数：${nv}`
    return `名单操作`
  }
  return `${et}: ${act}`
}

function generateAffectedEntities(entry: any): any[] {
  const result: any[] = []
  const et = entry.entity_type
  const eid = entry.entity_id

  if (et === 'param') {
    result.push({ table: 'param_entries', id: eid })
  } else if (et === 'boundary_sample') {
    result.push({ table: 'boundary_samples', id: eid })
    const sample = db.prepare('SELECT record_id FROM boundary_samples WHERE id = ?').get(eid) as any
    if (sample?.record_id) {
      result.push({ table: 'sampling_records', id: sample.record_id })
    }
  } else if (et === 'sampling_record') {
    result.push({ table: 'sampling_records', id: eid })
    if (entry.action === 'update_remark') {
      result.push({ table: 'record_remark_history', id: '相关历史记录' })
    }
  } else if (et === 'sampling_list') {
    result.push({ table: 'sampling_lists', id: eid })
  }
  return result
}

function generateRollbackPreview(entry: any): any[] {
  const result: any[] = []
  result.push({
    field: entry.field || entry.action,
    willBecome: entry.old_value,
    currentValue: entry.new_value
  })
  return result
}

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

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params

    const entry = db.prepare('SELECT * FROM change_log WHERE id = ?').get(id) as any
    if (!entry) {
      res.status(404).json({ success: false, error: '变更记录不存在' })
      return
    }

    const humanReadable = generateHumanReadable(entry)
    const affectedEntities = generateAffectedEntities(entry)
    const rollbackPreview = generateRollbackPreview(entry)

    res.json({
      success: true,
      data: {
        ...entry,
        humanReadable,
        affectedEntities,
        rollbackPreview
      }
    })
  } catch (error) {
    console.error('查询变更详情失败:', error)
    res.status(500).json({ success: false, error: '查询变更详情失败' })
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
      res.status(400).json({ success: false, error: '该变更已被回滚或被依赖，不可回滚' })
      return
    }

    const rollbackOperator = operator || 'system'
    const rollbackRole = operatorRole || 'system'
    const rollbackDetails: any = { tables: [], fields: [] }

    const transaction = db.transaction(() => {
      if (entry.entity_type === 'param' && entry.field === 'value') {
        const realOld = db.prepare('SELECT value FROM param_entries WHERE id = ?').get(entry.entity_id) as any
        const realOldVal = realOld ? String(realOld.value) : entry.new_value
        db.prepare('UPDATE param_entries SET value = ? WHERE id = ?').run(parseFloat(entry.old_value), entry.entity_id)
        rollbackDetails.tables.push('param_entries')
        rollbackDetails.fields.push({ table: 'param_entries', field: 'value', from: realOldVal, to: entry.old_value })
        db.prepare('INSERT INTO change_log (id, entity_type, entity_id, action, field, old_value, new_value, operator, operator_role, can_rollback) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)').run(
          uuidv4(), entry.entity_type, entry.entity_id, 'rollback', entry.field, realOldVal, entry.old_value, rollbackOperator, rollbackRole
        )
      } else if (entry.entity_type === 'param' && entry.field === 'description') {
        const realOld = db.prepare('SELECT description FROM param_entries WHERE id = ?').get(entry.entity_id) as any
        const realOldVal = realOld ? realOld.description : entry.new_value
        db.prepare('UPDATE param_entries SET description = ? WHERE id = ?').run(entry.old_value, entry.entity_id)
        rollbackDetails.tables.push('param_entries')
        rollbackDetails.fields.push({ table: 'param_entries', field: 'description', from: realOldVal, to: entry.old_value })
        db.prepare('INSERT INTO change_log (id, entity_type, entity_id, action, field, old_value, new_value, operator, operator_role, can_rollback) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)').run(
          uuidv4(), entry.entity_type, entry.entity_id, 'rollback', entry.field, realOldVal, entry.old_value, rollbackOperator, rollbackRole
        )
      } else if (entry.entity_type === 'boundary_sample' && entry.field === 'status') {
        const realOldSample = db.prepare('SELECT status, record_id FROM boundary_samples WHERE id = ?').get(entry.entity_id) as any
        const realOldVal = realOldSample ? realOldSample.status : entry.new_value
        db.prepare('UPDATE boundary_samples SET status = ? WHERE id = ?').run(entry.old_value, entry.entity_id)
        rollbackDetails.tables.push('boundary_samples')
        rollbackDetails.fields.push({ table: 'boundary_samples', field: 'status', from: realOldVal, to: entry.old_value })
        const sample = db.prepare('SELECT * FROM boundary_samples WHERE id = ?').get(entry.entity_id) as Record<string, any> | undefined
        if (sample) {
          const realOldRec = db.prepare('SELECT boundary_status FROM sampling_records WHERE id = ?').get(sample.record_id) as any
          const realOldRecVal = realOldRec ? realOldRec.boundary_status : entry.new_value
          db.prepare('UPDATE sampling_records SET boundary_status = ? WHERE id = ?').run(entry.old_value, sample.record_id)
          rollbackDetails.tables.push('sampling_records')
          rollbackDetails.fields.push({ table: 'sampling_records', field: 'boundary_status', from: realOldRecVal, to: entry.old_value })
        }
        db.prepare('INSERT INTO change_log (id, entity_type, entity_id, action, field, old_value, new_value, operator, operator_role, can_rollback) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)').run(
          uuidv4(), entry.entity_type, entry.entity_id, 'rollback', entry.field, realOldVal, entry.old_value, rollbackOperator, rollbackRole
        )
      } else if (entry.entity_type === 'sampling_record' && entry.action === 'update_remark') {
        const history = db.prepare(
          'SELECT old_remark FROM record_remark_history WHERE record_id = ? ORDER BY changed_at DESC LIMIT 1'
        ).get(entry.entity_id) as any
        const targetRemark = history?.old_remark ?? entry.old_value
        const realOld = db.prepare('SELECT remark FROM sampling_records WHERE id = ?').get(entry.entity_id) as any
        const realOldVal = realOld ? realOld.remark : entry.new_value
        db.prepare('UPDATE sampling_records SET remark = ? WHERE id = ?').run(targetRemark, entry.entity_id)
        rollbackDetails.tables.push('sampling_records')
        rollbackDetails.fields.push({ table: 'sampling_records', field: 'remark', from: realOldVal, to: targetRemark })
        db.prepare('INSERT INTO change_log (id, entity_type, entity_id, action, field, old_value, new_value, operator, operator_role, can_rollback) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)').run(
          uuidv4(), entry.entity_type, entry.entity_id, 'rollback', 'remark', realOldVal, targetRemark, rollbackOperator, rollbackRole
        )
      } else if (entry.entity_type === 'sampling_record' && entry.action === 'correct_value') {
        const realOld = db.prepare('SELECT original_value FROM sampling_records WHERE id = ?').get(entry.entity_id) as any
        const realOldVal = realOld ? String(realOld.original_value) : entry.new_value
        db.prepare('UPDATE sampling_records SET original_value = ? WHERE id = ?').run(parseFloat(entry.old_value), entry.entity_id)
        rollbackDetails.tables.push('sampling_records')
        rollbackDetails.fields.push({ table: 'sampling_records', field: 'original_value', from: realOldVal, to: entry.old_value })
        const boundary = db.prepare('SELECT id FROM boundary_samples WHERE record_id = ?').get(entry.entity_id) as any
        if (boundary) {
          const realOldBs = db.prepare('SELECT corrected_value FROM boundary_samples WHERE id = ?').get(boundary.id) as any
          const realOldBsVal = realOldBs ? (realOldBs.corrected_value !== null ? String(realOldBs.corrected_value) : 'NULL') : entry.new_value
          db.prepare('UPDATE boundary_samples SET corrected_value = NULL WHERE id = ?').run(boundary.id)
          rollbackDetails.tables.push('boundary_samples')
          rollbackDetails.fields.push({ table: 'boundary_samples', field: 'corrected_value', from: realOldBsVal, to: 'NULL' })
        }
        db.prepare('INSERT INTO change_log (id, entity_type, entity_id, action, field, old_value, new_value, operator, operator_role, can_rollback) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)').run(
          uuidv4(), entry.entity_type, entry.entity_id, 'rollback', 'original_value', realOldVal, entry.old_value, rollbackOperator, rollbackRole
        )
      } else {
        throw new Error('该变更类型暂不支持回滚')
      }

      db.prepare('UPDATE change_log SET can_rollback = 0 WHERE id = ?').run(id)
    })

    transaction()

    res.json({ success: true, message: '回滚成功', rollbackDetails })
  } catch (error: any) {
    console.error('回滚失败:', error)
    res.status(500).json({ success: false, error: error.message || '回滚操作失败' })
  }
})

export default router
