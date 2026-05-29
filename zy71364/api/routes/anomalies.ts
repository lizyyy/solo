import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../database.js'

const router = Router()

function toCamelCase(row: Record<string, unknown>) {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    result[camel] = row[key]
  }
  return result
}

router.get('/restorations/:id/anomalies', (req: Request, res: Response): void => {
  const restoration = db.prepare('SELECT id FROM restorations WHERE id = ?').get(req.params.id)
  if (!restoration) {
    res.status(404).json({ success: false, error: '修复记录不存在' })
    return
  }

  const rows = db.prepare('SELECT * FROM anomalies WHERE restoration_id = ? ORDER BY detected_at DESC').all(req.params.id) as Record<string, unknown>[]
  res.json({ success: true, data: rows.map(toCamelCase) })
})

router.post('/restorations/:id/anomalies/check', (req: Request, res: Response): void => {
  const restoration = db.prepare('SELECT * FROM restorations WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!restoration) {
    res.status(404).json({ success: false, error: '修复记录不存在' })
    return
  }

  const rid = req.params.id
  const now = new Date().toISOString()
  const detectedAnomalies: Record<string, unknown>[] = []

  const insertAnomaly = db.prepare(`
    INSERT INTO anomalies (id, restoration_id, step_id, material_id, type, severity, description, detected_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const detect = db.transaction(() => {
    const steps = db.prepare('SELECT * FROM restoration_steps WHERE restoration_id = ? ORDER BY step_order').all(rid) as Record<string, unknown>[]

    for (const step of steps) {
      const photoCount = (db.prepare('SELECT COUNT(*) as cnt FROM photos WHERE step_id = ?').get(step.id) as { cnt: number }).cnt
      if (photoCount === 0) {
        const existing = db.prepare('SELECT id FROM anomalies WHERE restoration_id = ? AND step_id = ? AND type = ? AND status = ?').get(rid, step.id, 'missing_photo', 'open')
        if (!existing) {
          const aid = uuidv4()
          insertAnomaly.run(aid, rid, step.id, null, 'missing_photo', 'warning', `步骤"${step.description}"缺少照片记录`, now, 'open')
          detectedAnomalies.push({ id: aid, type: 'missing_photo', stepId: step.id, description: `步骤"${step.description}"缺少照片记录` })
        }
      }
    }

    for (let i = 1; i < steps.length; i++) {
      const prev = steps[i - 1]
      const curr = steps[i]
      if ((curr.step_order as number) > (prev.step_order as number) && (curr.performed_at as string) < (prev.performed_at as string)) {
        const existing = db.prepare('SELECT id FROM anomalies WHERE restoration_id = ? AND step_id = ? AND type = ? AND status = ?').get(rid, curr.id, 'step_order_inverted', 'open')
        if (!existing) {
          const aid = uuidv4()
          insertAnomaly.run(aid, rid, curr.id, null, 'step_order_inverted', 'error', `步骤"${curr.description}"(顺序${curr.step_order})的执行时间早于前一步"${prev.description}"(顺序${prev.step_order})`, now, 'open')
          detectedAnomalies.push({ id: aid, type: 'step_order_inverted', stepId: curr.id, description: `步骤顺序倒置` })
        }
      }
    }

    const materials = db.prepare(`
      SELECT mb.* FROM material_batches mb
      JOIN restoration_steps rs ON mb.step_id = rs.id
      WHERE rs.restoration_id = ?
    `).all(rid) as Record<string, unknown>[]

    for (const mat of materials) {
      const batchNumber = mat.batch_number as string
      if (!/^[A-Z]{2}\d{8}$/.test(batchNumber)) {
        db.prepare('UPDATE material_batches SET status = ? WHERE id = ?').run('batch_error', mat.id)
        const existing = db.prepare('SELECT id FROM anomalies WHERE restoration_id = ? AND material_id = ? AND type = ? AND status = ?').get(rid, mat.id, 'batch_number_error', 'open')
        if (!existing) {
          const aid = uuidv4()
          insertAnomaly.run(aid, rid, null, mat.id, 'batch_number_error', 'error', `材料"${mat.name}"批号格式不合规：${batchNumber}`, now, 'open')
          detectedAnomalies.push({ id: aid, type: 'batch_number_error', materialId: mat.id, description: `材料"${mat.name}"批号格式不合规` })
        }
      }

      const expiryDate = mat.expiry_date as string
      if (new Date(expiryDate) < new Date()) {
        db.prepare('UPDATE material_batches SET status = ? WHERE id = ?').run('expired', mat.id)
        const existing = db.prepare('SELECT id FROM anomalies WHERE restoration_id = ? AND material_id = ? AND type = ? AND status = ?').get(rid, mat.id, 'material_expired', 'open')
        if (!existing) {
          const aid = uuidv4()
          insertAnomaly.run(aid, rid, null, mat.id, 'material_expired', 'error', `材料"${mat.name}"已过期（有效期至${expiryDate}）`, now, 'open')
          detectedAnomalies.push({ id: aid, type: 'material_expired', materialId: mat.id, description: `材料"${mat.name}"已过期` })
        }
      }
    }
  })

  detect()
  res.json({ success: true, data: detectedAnomalies })
})

router.post('/anomalies/:id/corrections', (req: Request, res: Response): void => {
  const anomaly = db.prepare('SELECT * FROM anomalies WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!anomaly) {
    res.status(404).json({ success: false, error: '异常不存在' })
    return
  }

  const { correctedBy, correctionType, beforeValue, afterValue, reason } = req.body
  if (!correctedBy || !correctionType || !beforeValue || !afterValue || !reason) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }

  const id = uuidv4()
  const now = new Date().toISOString()

  const insertCorrection = db.transaction(() => {
    db.prepare(`
      INSERT INTO corrections (id, anomaly_id, corrected_by, correction_type, before_value, after_value, reason, corrected_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, req.params.id, correctedBy, correctionType, beforeValue, afterValue, reason, now)

    db.prepare('UPDATE anomalies SET status = ? WHERE id = ?').run('corrected', req.params.id)
  })

  insertCorrection()

  const row = db.prepare('SELECT * FROM corrections WHERE id = ?').get(id) as Record<string, unknown>
  res.status(201).json({ success: true, data: toCamelCase(row) })
})

router.get('/anomalies/:id/corrections', (req: Request, res: Response): void => {
  const anomaly = db.prepare('SELECT * FROM anomalies WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!anomaly) {
    res.status(404).json({ success: false, error: '异常不存在' })
    return
  }

  const rows = db.prepare('SELECT * FROM corrections WHERE anomaly_id = ? ORDER BY corrected_at').all(req.params.id) as Record<string, unknown>[]
  res.json({ success: true, data: rows.map(toCamelCase) })
})

export default router
