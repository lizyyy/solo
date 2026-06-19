import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

interface ChangeLogEntry {
  id: string
  entity_type: string
  entity_id: string
  action: string
  field: string | null
  old_value: string | null
  new_value: string | null
  operator: string
  operator_role: string
  timestamp: string
  can_rollback: number
}

interface BoundarySampleFull {
  id: string
  record_id: string
  type: string
  status: string
  description: string
  detected_at: string
  confirmed_by: string | null
  confirmed_at: string | null
  original_value: number | null
  corrected_value: number | null
  process_reason: string
  decision_detail: string
}

interface SamplingRecordFull {
  id: string
  original_value: number
  is_negative: number
  boundary_status: string
}

interface AffectedEntity {
  table: string
  id: string
}

interface RollbackField {
  field: string
  willBecome: string | null
  currentValue: string | null
}

interface RollbackDetailField {
  table: string
  field: string
  from: string
  to: string
}

interface RollbackDetails {
  tables: string[]
  fields: RollbackDetailField[]
}

const router = Router()

function generateHumanReadable(entry: ChangeLogEntry): string {
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
    if (act === 'update_status') return `将边界样本状态从 ${ov} 修改为 ${nv}`
    if (act === 'add_review') return `添加复核意见：${nv}`
    if (act === 'update_field') {
      const fieldNames: Record<string, string> = {
        confirmed_by: '确认人',
        confirmed_at: '确认时间',
        process_reason: '处理原因',
        decision_detail: '决策详情',
        corrected_value: '修正值'
      }
      const fname = fieldNames[f || ''] || f || '字段'
      return `将边界样本${fname}从 "${ov}" 修改为 "${nv}"`
    }
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

function generateAffectedEntities(entry: ChangeLogEntry): AffectedEntity[] {
  const result: AffectedEntity[] = []
  const et = entry.entity_type
  const eid = entry.entity_id

  if (et === 'param') {
    result.push({ table: 'param_entries', id: eid })
  } else if (et === 'boundary_sample') {
    result.push({ table: 'boundary_samples', id: eid })
    const sample = db.prepare('SELECT record_id FROM boundary_samples WHERE id = ?').get(eid) as { record_id: string } | undefined
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

function generateRollbackPreview(entry: ChangeLogEntry): RollbackField[] {
  const result: RollbackField[] = []
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

    const entry = db.prepare('SELECT * FROM change_log WHERE id = ?').get(id) as ChangeLogEntry | undefined
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

    const entry = db.prepare('SELECT * FROM change_log WHERE id = ?').get(id) as ChangeLogEntry | undefined
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
    const rollbackDetails: RollbackDetails = { tables: [], fields: [] }

    const addTable = (table: string): void => {
      if (!rollbackDetails.tables.includes(table)) {
        rollbackDetails.tables.push(table)
      }
    }

    const addField = (table: string, field: string, from: string, to: string): void => {
      rollbackDetails.fields.push({ table, field, from, to })
    }

    const insertRollbackLog = (entityType: string, entityId: string, field: string, oldVal: string, newVal: string): void => {
      db.prepare(
        'INSERT INTO change_log (id, entity_type, entity_id, action, field, old_value, new_value, operator, operator_role, can_rollback) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)'
      ).run(uuidv4(), entityType, entityId, 'rollback', field, oldVal, newVal, rollbackOperator, rollbackRole)
    }

    const transaction = db.transaction((): void => {
      if (entry.entity_type === 'param' && entry.field === 'value') {
        const realOld = db.prepare('SELECT value FROM param_entries WHERE id = ?').get(entry.entity_id) as { value: number } | undefined
        const realOldVal = realOld ? String(realOld.value) : entry.new_value
        db.prepare('UPDATE param_entries SET value = ? WHERE id = ?').run(parseFloat(entry.old_value as string), entry.entity_id)
        addTable('param_entries')
        addField('param_entries', 'value', realOldVal as string, entry.old_value as string)
        insertRollbackLog(entry.entity_type, entry.entity_id, entry.field as string, realOldVal as string, entry.old_value as string)
      } else if (entry.entity_type === 'param' && entry.field === 'description') {
        const realOld = db.prepare('SELECT description FROM param_entries WHERE id = ?').get(entry.entity_id) as { description: string } | undefined
        const realOldVal = realOld ? realOld.description : entry.new_value
        db.prepare('UPDATE param_entries SET description = ? WHERE id = ?').run(entry.old_value, entry.entity_id)
        addTable('param_entries')
        addField('param_entries', 'description', realOldVal as string, entry.old_value as string)
        insertRollbackLog(entry.entity_type, entry.entity_id, entry.field as string, realOldVal as string, entry.old_value as string)
      } else if (entry.entity_type === 'boundary_sample' && entry.field === 'status') {
        const curBs = db.prepare('SELECT * FROM boundary_samples WHERE id = ?').get(entry.entity_id) as BoundarySampleFull | undefined
        if (!curBs) {
          throw new Error('边界样本不存在')
        }

        const realOldStatus = curBs.status
        db.prepare('UPDATE boundary_samples SET status = ? WHERE id = ?').run(entry.old_value, entry.entity_id)
        addTable('boundary_samples')
        addField('boundary_samples', 'status', realOldStatus, entry.old_value as string)
        insertRollbackLog('boundary_sample', entry.entity_id, 'status', realOldStatus, entry.old_value as string)

        const oldProcessReason = curBs.process_reason
        db.prepare("UPDATE boundary_samples SET process_reason = '' WHERE id = ?").run(entry.entity_id)
        addField('boundary_samples', 'process_reason', oldProcessReason, '')
        insertRollbackLog('boundary_sample', entry.entity_id, 'process_reason', oldProcessReason, '')

        const oldDecisionDetail = curBs.decision_detail
        db.prepare("UPDATE boundary_samples SET decision_detail = '' WHERE id = ?").run(entry.entity_id)
        addField('boundary_samples', 'decision_detail', oldDecisionDetail, '')
        insertRollbackLog('boundary_sample', entry.entity_id, 'decision_detail', oldDecisionDetail, '')

        const oldConfirmedBy = curBs.confirmed_by
        db.prepare('UPDATE boundary_samples SET confirmed_by = NULL WHERE id = ?').run(entry.entity_id)
        addField('boundary_samples', 'confirmed_by', oldConfirmedBy ?? 'NULL', 'NULL')
        insertRollbackLog('boundary_sample', entry.entity_id, 'confirmed_by', oldConfirmedBy ?? 'NULL', 'NULL')

        const oldConfirmedAt = curBs.confirmed_at
        db.prepare('UPDATE boundary_samples SET confirmed_at = NULL WHERE id = ?').run(entry.entity_id)
        addField('boundary_samples', 'confirmed_at', oldConfirmedAt ?? 'NULL', 'NULL')
        insertRollbackLog('boundary_sample', entry.entity_id, 'confirmed_at', oldConfirmedAt ?? 'NULL', 'NULL')

        const oldCorrectedValue = curBs.corrected_value
        db.prepare('UPDATE boundary_samples SET corrected_value = NULL WHERE id = ?').run(entry.entity_id)
        addField('boundary_samples', 'corrected_value', oldCorrectedValue !== null ? String(oldCorrectedValue) : 'NULL', 'NULL')
        insertRollbackLog('boundary_sample', entry.entity_id, 'corrected_value', oldCorrectedValue !== null ? String(oldCorrectedValue) : 'NULL', 'NULL')

        if (curBs.original_value !== null && curBs.original_value !== undefined) {
          const curSr = db.prepare('SELECT original_value, is_negative, boundary_status FROM sampling_records WHERE id = ?').get(curBs.record_id) as SamplingRecordFull | undefined
          if (curSr) {
            const realCurrentVal = String(curSr.original_value)
            const realCurrentIsNegative = String(curSr.is_negative)
            const restoredIsNegative = curBs.original_value < 0 ? 1 : 0

            db.prepare(
              'UPDATE sampling_records SET original_value = ?, is_negative = ?, boundary_status = ? WHERE id = ?'
            ).run(curBs.original_value, restoredIsNegative, entry.old_value, curBs.record_id)

            addTable('sampling_records')
            addField('sampling_records', 'original_value', realCurrentVal, String(curBs.original_value))
            addField('sampling_records', 'is_negative', realCurrentIsNegative, String(restoredIsNegative))
            addField('sampling_records', 'boundary_status', curSr.boundary_status, entry.old_value as string)

            insertRollbackLog('sampling_record', curBs.record_id, 'original_value', realCurrentVal, String(curBs.original_value))
            insertRollbackLog('sampling_record', curBs.record_id, 'is_negative', realCurrentIsNegative, String(restoredIsNegative))
            insertRollbackLog('sampling_record', curBs.record_id, 'boundary_status', curSr.boundary_status, entry.old_value as string)
          }
        } else {
          const curSr = db.prepare('SELECT boundary_status FROM sampling_records WHERE id = ?').get(curBs.record_id) as { boundary_status: string } | undefined
          if (curSr) {
            db.prepare('UPDATE sampling_records SET boundary_status = ? WHERE id = ?').run(entry.old_value, curBs.record_id)
            addTable('sampling_records')
            addField('sampling_records', 'boundary_status', curSr.boundary_status, entry.old_value as string)
            insertRollbackLog('sampling_record', curBs.record_id, 'boundary_status', curSr.boundary_status, entry.old_value as string)
          }
        }

        const carResults = db.prepare('SELECT * FROM cost_allocation_results WHERE record_id = ?').all(curBs.record_id) as Record<string, unknown>[]
        if (carResults.length > 0) {
          addTable('cost_allocation_results')
          for (const car of carResults) {
            const carId = car.id as string
            const oldCarBoundaryStatus = (car.boundary_status as string) ?? ''
            db.prepare(
              'UPDATE cost_allocation_results SET is_boundary = 1, boundary_status = ? WHERE id = ?'
            ).run(entry.old_value, carId)
            addField('cost_allocation_results', 'boundary_status', oldCarBoundaryStatus || 'NULL', entry.old_value as string)
          }
        }
      } else if (entry.entity_type === 'boundary_sample' && entry.action === 'update_field') {
        const curBs = db.prepare('SELECT * FROM boundary_samples WHERE id = ?').get(entry.entity_id) as BoundarySampleFull | undefined
        if (!curBs) {
          throw new Error('边界样本不存在')
        }
        const field = entry.field || ''
        const oldVal = entry.old_value || ''
        const newVal = entry.new_value || ''

        addTable('boundary_samples')

        if (field === 'confirmed_by') {
          const realOld = curBs.confirmed_by ?? ''
          const target = oldVal === '' ? null : oldVal
          db.prepare('UPDATE boundary_samples SET confirmed_by = ? WHERE id = ?').run(target, entry.entity_id)
          addField('boundary_samples', 'confirmed_by', realOld || 'NULL', oldVal || 'NULL')
          insertRollbackLog('boundary_sample', entry.entity_id, 'confirmed_by', realOld || 'NULL', oldVal || 'NULL')
        } else if (field === 'confirmed_at') {
          const realOld = curBs.confirmed_at ?? ''
          const target = oldVal === '' ? null : oldVal
          db.prepare('UPDATE boundary_samples SET confirmed_at = ? WHERE id = ?').run(target, entry.entity_id)
          addField('boundary_samples', 'confirmed_at', realOld || 'NULL', oldVal || 'NULL')
          insertRollbackLog('boundary_sample', entry.entity_id, 'confirmed_at', realOld || 'NULL', oldVal || 'NULL')
        } else if (field === 'process_reason') {
          const realOld = curBs.process_reason
          db.prepare('UPDATE boundary_samples SET process_reason = ? WHERE id = ?').run(oldVal, entry.entity_id)
          addField('boundary_samples', 'process_reason', realOld, oldVal)
          insertRollbackLog('boundary_sample', entry.entity_id, 'process_reason', realOld, oldVal)
        } else if (field === 'decision_detail') {
          const realOld = curBs.decision_detail
          db.prepare('UPDATE boundary_samples SET decision_detail = ? WHERE id = ?').run(oldVal, entry.entity_id)
          addField('boundary_samples', 'decision_detail', realOld, oldVal)
          insertRollbackLog('boundary_sample', entry.entity_id, 'decision_detail', realOld, oldVal)
        } else if (field === 'corrected_value') {
          const realOld = curBs.corrected_value !== null && curBs.corrected_value !== undefined ? String(curBs.corrected_value) : 'NULL'
          const target = oldVal === '' || oldVal === 'NULL' ? null : parseFloat(oldVal)
          db.prepare('UPDATE boundary_samples SET corrected_value = ? WHERE id = ?').run(target, entry.entity_id)
          addField('boundary_samples', 'corrected_value', realOld, oldVal || 'NULL')
          insertRollbackLog('boundary_sample', entry.entity_id, 'corrected_value', realOld, oldVal || 'NULL')
        } else {
          throw new Error(`不支持回滚的字段: ${field}`)
        }
      } else if (entry.entity_type === 'sampling_record' && entry.action === 'update_remark') {
        const history = db.prepare(
          'SELECT old_remark FROM record_remark_history WHERE record_id = ? ORDER BY changed_at DESC LIMIT 1'
        ).get(entry.entity_id) as { old_remark: string } | undefined
        const targetRemark = history?.old_remark ?? entry.old_value
        const realOld = db.prepare('SELECT remark FROM sampling_records WHERE id = ?').get(entry.entity_id) as { remark: string } | undefined
        const realOldVal = realOld ? realOld.remark : entry.new_value
        db.prepare('UPDATE sampling_records SET remark = ? WHERE id = ?').run(targetRemark, entry.entity_id)
        addTable('sampling_records')
        addField('sampling_records', 'remark', realOldVal as string, targetRemark as string)
        insertRollbackLog('sampling_record', entry.entity_id, 'remark', realOldVal as string, targetRemark as string)
      } else if (entry.entity_type === 'sampling_record' && entry.action === 'correct_value') {
        const realOld = db.prepare('SELECT original_value, is_negative FROM sampling_records WHERE id = ?').get(entry.entity_id) as { original_value: number; is_negative: number } | undefined
        const realOldVal = realOld ? String(realOld.original_value) : entry.new_value
        const realOldIsNegative = realOld ? String(realOld.is_negative) : '0'
        const parsedOldValue = parseFloat(entry.old_value as string)
        const restoredIsNegative = parsedOldValue < 0 ? 1 : 0

        db.prepare('UPDATE sampling_records SET original_value = ?, is_negative = ? WHERE id = ?').run(parsedOldValue, restoredIsNegative, entry.entity_id)
        addTable('sampling_records')
        addField('sampling_records', 'original_value', realOldVal as string, entry.old_value as string)
        addField('sampling_records', 'is_negative', realOldIsNegative, String(restoredIsNegative))
        insertRollbackLog('sampling_record', entry.entity_id, 'original_value', realOldVal as string, entry.old_value as string)
        insertRollbackLog('sampling_record', entry.entity_id, 'is_negative', realOldIsNegative, String(restoredIsNegative))

        const boundary = db.prepare('SELECT id FROM boundary_samples WHERE record_id = ?').get(entry.entity_id) as { id: string } | undefined
        if (boundary) {
          const realOldBs = db.prepare('SELECT corrected_value FROM boundary_samples WHERE id = ?').get(boundary.id) as { corrected_value: number | null } | undefined
          const realOldBsVal = realOldBs ? (realOldBs.corrected_value !== null ? String(realOldBs.corrected_value) : 'NULL') : entry.new_value
          db.prepare('UPDATE boundary_samples SET corrected_value = NULL WHERE id = ?').run(boundary.id)
          addTable('boundary_samples')
          addField('boundary_samples', 'corrected_value', realOldBsVal as string, 'NULL')
          insertRollbackLog('boundary_sample', boundary.id, 'corrected_value', realOldBsVal as string, 'NULL')
        }
      } else {
        throw new Error('该变更类型暂不支持回滚')
      }

      db.prepare('UPDATE change_log SET can_rollback = 0 WHERE id = ?').run(id)
    })

    transaction()

    res.json({ success: true, message: '回滚成功', rollbackDetails })
  } catch (error: unknown) {
    const err = error as { message?: string }
    console.error('回滚失败:', error)
    res.status(500).json({ success: false, error: err.message || '回滚操作失败' })
  }
})

export default router
