import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { runValidation } from './validate.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const { material, status, date_from, date_to } = req.query
    let sql = `
      SELECT r.*, m.name as material_name
      FROM records r
      JOIN materials m ON r.material_id = m.id
      WHERE 1=1
    `
    const params: any[] = []
    if (material) {
      sql += ' AND r.material_id = ?'
      params.push(material)
    }
    if (status) {
      sql += ' AND r.status = ?'
      params.push(status)
    }
    if (date_from) {
      sql += ' AND r.created_at >= ?'
      params.push(date_from)
    }
    if (date_to) {
      sql += ' AND r.created_at <= ?'
      params.push(date_to)
    }
    sql += ' ORDER BY r.created_at DESC'
    const records = db.prepare(sql).all(...params)
    res.json({ success: true, data: records })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.post('/', (req: Request, res: Response): void => {
  try {
    const { material_id, laser_power, move_speed, focal_length, line_width, operator } = req.body
    if (!material_id || laser_power == null || move_speed == null || focal_length == null || line_width == null) {
      res.status(400).json({ success: false, error: '缺少必要参数' })
      return
    }

    const validation = runValidation(material_id, laser_power, move_speed, focal_length, line_width)
    const energy_density = validation.energy_density
    const risk_level = validation.risk_level
    const risk_messages = JSON.stringify([...validation.errors, ...validation.warnings])

    const stmt = db.prepare(`
      INSERT INTO records (material_id, laser_power, move_speed, focal_length, line_width, energy_density, risk_level, risk_messages, operator)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const result = stmt.run(material_id, laser_power, move_speed, focal_length, line_width, energy_density, risk_level, risk_messages, operator || '')

    const recordId = result.lastInsertRowid
    db.prepare(`
      INSERT INTO audit_logs (record_id, action, operator, changes)
      VALUES (?, 'create', ?, ?)
    `).run(recordId, operator || '', JSON.stringify([{ field: 'status', from: null, to: 'draft' }]))

    const record = db.prepare(`
      SELECT r.*, m.name as material_name
      FROM records r
      JOIN materials m ON r.material_id = m.id
      WHERE r.id = ?
    `).get(recordId)
    res.json({ success: true, data: record })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.put('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const record = db.prepare('SELECT * FROM records WHERE id = ?').get(id) as any
    if (!record) {
      res.status(404).json({ success: false, error: '记录不存在' })
      return
    }
    if (record.status !== 'draft') {
      res.status(400).json({ success: false, error: '仅草稿状态可编辑' })
      return
    }

    const { material_id, laser_power, move_speed, focal_length, line_width, operator } = req.body
    const changes: { field: string; from: any; to: any }[] = []

    const newMaterialId = material_id ?? record.material_id
    const newLaserPower = laser_power ?? record.laser_power
    const newMoveSpeed = move_speed ?? record.move_speed
    const newFocalLength = focal_length ?? record.focal_length
    const newLineWidth = line_width ?? record.line_width
    const newOperator = operator ?? record.operator

    if (material_id != null && material_id !== record.material_id) changes.push({ field: 'material_id', from: record.material_id, to: material_id })
    if (laser_power != null && laser_power !== record.laser_power) changes.push({ field: 'laser_power', from: record.laser_power, to: laser_power })
    if (move_speed != null && move_speed !== record.move_speed) changes.push({ field: 'move_speed', from: record.move_speed, to: move_speed })
    if (focal_length != null && focal_length !== record.focal_length) changes.push({ field: 'focal_length', from: record.focal_length, to: focal_length })
    if (line_width != null && line_width !== record.line_width) changes.push({ field: 'line_width', from: record.line_width, to: line_width })

    const validation = runValidation(newMaterialId, newLaserPower, newMoveSpeed, newFocalLength, newLineWidth)
    const energy_density = validation.energy_density
    const risk_level = validation.risk_level
    const risk_messages = JSON.stringify([...validation.errors, ...validation.warnings])

    db.prepare(`
      UPDATE records SET material_id = ?, laser_power = ?, move_speed = ?, focal_length = ?, line_width = ?,
        energy_density = ?, risk_level = ?, risk_messages = ?, operator = ?,
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(newMaterialId, newLaserPower, newMoveSpeed, newFocalLength, newLineWidth, energy_density, risk_level, risk_messages, newOperator, id)

    if (changes.length > 0) {
      db.prepare(`
        INSERT INTO audit_logs (record_id, action, operator, changes)
        VALUES (?, 'update', ?, ?)
      `).run(id, newOperator, JSON.stringify(changes))
    }

    const updated = db.prepare(`
      SELECT r.*, m.name as material_name
      FROM records r
      JOIN materials m ON r.material_id = m.id
      WHERE r.id = ?
    `).get(id)
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.post('/:id/validate', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const record = db.prepare('SELECT * FROM records WHERE id = ?').get(id) as any
    if (!record) {
      res.status(404).json({ success: false, error: '记录不存在' })
      return
    }
    if (record.status !== 'draft') {
      res.status(400).json({ success: false, error: '仅草稿状态可提交校验' })
      return
    }

    const messages = JSON.parse(record.risk_messages || '[]') as string[]
    const hasErrors = messages.length > 0 && messages.some((m: string) =>
      m.includes('激光功率') || m.includes('移动速度不能') || m.includes('疑似单位错误') || m.includes('线宽') || m.includes('焦距')
    )
    if (hasErrors) {
      res.status(400).json({ success: false, error: '存在阻断性错误，无法提交校验' })
      return
    }

    db.prepare(`
      UPDATE records SET status = 'validated', updated_at = datetime('now','localtime') WHERE id = ?
    `).run(id)

    db.prepare(`
      INSERT INTO audit_logs (record_id, action, operator, changes)
      VALUES (?, 'validate', ?, ?)
    `).run(id, record.operator, JSON.stringify([{ field: 'status', from: 'draft', to: 'validated' }]))

    const updated = db.prepare(`
      SELECT r.*, m.name as material_name
      FROM records r
      JOIN materials m ON r.material_id = m.id
      WHERE r.id = ?
    `).get(id)
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.post('/:id/approve', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { reviewer } = req.body
    if (!reviewer) {
      res.status(400).json({ success: false, error: '审核人不能为空' })
      return
    }
    const record = db.prepare('SELECT * FROM records WHERE id = ?').get(id) as any
    if (!record) {
      res.status(404).json({ success: false, error: '记录不存在' })
      return
    }
    if (record.status !== 'validated') {
      res.status(400).json({ success: false, error: '仅已校验状态可审核通过' })
      return
    }

    db.prepare(`
      UPDATE records SET status = 'approved', reviewer = ?, updated_at = datetime('now','localtime') WHERE id = ?
    `).run(reviewer, id)

    db.prepare(`
      INSERT INTO audit_logs (record_id, action, operator, changes)
      VALUES (?, 'approve', ?, ?)
    `).run(id, reviewer, JSON.stringify([{ field: 'status', from: 'validated', to: 'approved' }]))

    const updated = db.prepare(`
      SELECT r.*, m.name as material_name
      FROM records r
      JOIN materials m ON r.material_id = m.id
      WHERE r.id = ?
    `).get(id)
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.post('/:id/reject', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { reason, operator } = req.body
    if (!reason) {
      res.status(400).json({ success: false, error: '退回原因不能为空' })
      return
    }
    const record = db.prepare('SELECT * FROM records WHERE id = ?').get(id) as any
    if (!record) {
      res.status(404).json({ success: false, error: '记录不存在' })
      return
    }
    if (record.status !== 'validated') {
      res.status(400).json({ success: false, error: '仅已校验状态可退回' })
      return
    }

    db.prepare(`
      UPDATE records SET status = 'draft', updated_at = datetime('now','localtime') WHERE id = ?
    `).run(id)

    db.prepare(`
      INSERT INTO audit_logs (record_id, action, operator, changes, reason)
      VALUES (?, 'reject', ?, ?, ?)
    `).run(id, operator || '', JSON.stringify([{ field: 'status', from: 'validated', to: 'draft' }]), reason)

    const updated = db.prepare(`
      SELECT r.*, m.name as material_name
      FROM records r
      JOIN materials m ON r.material_id = m.id
      WHERE r.id = ?
    `).get(id)
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.post('/:id/withdraw', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { reason, operator } = req.body
    if (!reason) {
      res.status(400).json({ success: false, error: '撤回原因不能为空' })
      return
    }
    const record = db.prepare('SELECT * FROM records WHERE id = ?').get(id) as any
    if (!record) {
      res.status(404).json({ success: false, error: '记录不存在' })
      return
    }
    if (record.status !== 'approved') {
      res.status(400).json({ success: false, error: '仅已审核状态可撤回' })
      return
    }

    db.prepare(`
      UPDATE records SET status = 'draft', updated_at = datetime('now','localtime') WHERE id = ?
    `).run(id)

    db.prepare(`
      INSERT INTO audit_logs (record_id, action, operator, changes, reason)
      VALUES (?, 'withdraw', ?, ?, ?)
    `).run(id, operator || '', JSON.stringify([{ field: 'status', from: 'approved', to: 'draft' }]), reason)

    const updated = db.prepare(`
      SELECT r.*, m.name as material_name
      FROM records r
      JOIN materials m ON r.material_id = m.id
      WHERE r.id = ?
    `).get(id)
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.post('/:id/retroact', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const record = db.prepare('SELECT * FROM records WHERE id = ?').get(id) as any
    if (!record) {
      res.status(404).json({ success: false, error: '记录不存在' })
      return
    }

    db.prepare(`
      UPDATE records SET status = 'approved', is_retroactive = 1, updated_at = datetime('now','localtime') WHERE id = ?
    `).run(id)

    db.prepare(`
      INSERT INTO audit_logs (record_id, action, operator, changes)
      VALUES (?, 'retroact', ?, ?)
    `).run(id, record.operator || '', JSON.stringify([{ field: 'status', from: record.status, to: 'approved' }, { field: 'is_retroactive', from: 0, to: 1 }]))

    const updated = db.prepare(`
      SELECT r.*, m.name as material_name
      FROM records r
      JOIN materials m ON r.material_id = m.id
      WHERE r.id = ?
    `).get(id)
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.post('/:id/archive', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { operator } = req.body
    const record = db.prepare('SELECT * FROM records WHERE id = ?').get(id) as any
    if (!record) {
      res.status(404).json({ success: false, error: '记录不存在' })
      return
    }
    if (record.status !== 'approved') {
      res.status(400).json({ success: false, error: '仅已审核状态可归档' })
      return
    }

    db.prepare(`
      UPDATE records SET status = 'archived', updated_at = datetime('now','localtime') WHERE id = ?
    `).run(id)

    db.prepare(`
      INSERT INTO audit_logs (record_id, action, operator, changes)
      VALUES (?, 'archive', ?, ?)
    `).run(id, operator || '', JSON.stringify([{ field: 'status', from: 'approved', to: 'archived' }]))

    const updated = db.prepare(`
      SELECT r.*, m.name as material_name
      FROM records r
      JOIN materials m ON r.material_id = m.id
      WHERE r.id = ?
    `).get(id)
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.post('/:id/reactivate', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { operator } = req.body
    const record = db.prepare('SELECT * FROM records WHERE id = ?').get(id) as any
    if (!record) {
      res.status(404).json({ success: false, error: '记录不存在' })
      return
    }
    if (record.status !== 'archived') {
      res.status(400).json({ success: false, error: '仅已归档状态可重新激活' })
      return
    }

    db.prepare(`
      UPDATE records SET status = 'approved', updated_at = datetime('now','localtime') WHERE id = ?
    `).run(id)

    db.prepare(`
      INSERT INTO audit_logs (record_id, action, operator, changes)
      VALUES (?, 'reactivate', ?, ?)
    `).run(id, operator || '', JSON.stringify([{ field: 'status', from: 'archived', to: 'approved' }]))

    const updated = db.prepare(`
      SELECT r.*, m.name as material_name
      FROM records r
      JOIN materials m ON r.material_id = m.id
      WHERE r.id = ?
    `).get(id)
    res.json({ success: true, data: updated })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.get('/:id/audit-logs', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const record = db.prepare('SELECT * FROM records WHERE id = ?').get(id)
    if (!record) {
      res.status(404).json({ success: false, error: '记录不存在' })
      return
    }
    const logs = db.prepare('SELECT * FROM audit_logs WHERE record_id = ? ORDER BY created_at DESC').all(id)
    res.json({ success: true, data: logs })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
