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

router.get('/restorations/:id/materials', (req: Request, res: Response): void => {
  const restoration = db.prepare('SELECT id FROM restorations WHERE id = ?').get(req.params.id)
  if (!restoration) {
    res.status(404).json({ success: false, error: '修复记录不存在' })
    return
  }

  const rows = db.prepare(`
    SELECT mb.* FROM material_batches mb
    JOIN restoration_steps rs ON mb.step_id = rs.id
    WHERE rs.restoration_id = ?
    ORDER BY mb.created_at
  `).all(req.params.id) as Record<string, unknown>[]
  res.json({ success: true, data: rows.map(toCamelCase) })
})

router.post('/restorations/:id/materials', (req: Request, res: Response): void => {
  const restoration = db.prepare('SELECT id FROM restorations WHERE id = ?').get(req.params.id)
  if (!restoration) {
    res.status(404).json({ success: false, error: '修复记录不存在' })
    return
  }

  const { stepId, batchNumber, name, supplier, expiryDate } = req.body
  if (!stepId || !batchNumber || !name || !supplier || !expiryDate) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }

  const step = db.prepare('SELECT id FROM restoration_steps WHERE id = ? AND restoration_id = ?').get(stepId, req.params.id)
  if (!step) {
    res.status(404).json({ success: false, error: '步骤不存在' })
    return
  }

  const validBatch = /^[A-Z]{2}\d{8}$/.test(batchNumber)
  const expired = new Date(expiryDate) < new Date()
  let materialStatus: string = 'normal'
  if (expired) materialStatus = 'expired'
  else if (!validBatch) materialStatus = 'batch_error'

  const id = uuidv4()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO material_batches (id, step_id, batch_number, name, supplier, expiry_date, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, stepId, batchNumber, name, supplier, expiryDate, materialStatus, now)

  const row = db.prepare('SELECT * FROM material_batches WHERE id = ?').get(id) as Record<string, unknown>
  res.status(201).json({ success: true, data: toCamelCase(row) })
})

router.put('/:id', (req: Request, res: Response): void => {
  const existing = db.prepare('SELECT * FROM material_batches WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!existing) {
    res.status(404).json({ success: false, error: '材料不存在' })
    return
  }

  const { batchNumber, name, supplier, expiryDate, stepId } = req.body

  const finalBatch = batchNumber ?? existing.batch_number
  const finalExpiry = expiryDate ?? existing.expiry_date

  const validBatch = /^[A-Z]{2}\d{8}$/.test(finalBatch as string)
  const expired = new Date(finalExpiry as string) < new Date()
  let materialStatus: string = 'normal'
  if (expired) materialStatus = 'expired'
  else if (!validBatch) materialStatus = 'batch_error'

  db.prepare(`
    UPDATE material_batches SET
      step_id = COALESCE(?, step_id),
      batch_number = COALESCE(?, batch_number),
      name = COALESCE(?, name),
      supplier = COALESCE(?, supplier),
      expiry_date = COALESCE(?, expiry_date),
      status = ?
    WHERE id = ?
  `).run(stepId, batchNumber, name, supplier, expiryDate, materialStatus, req.params.id)

  const row = db.prepare('SELECT * FROM material_batches WHERE id = ?').get(req.params.id) as Record<string, unknown>
  res.json({ success: true, data: toCamelCase(row) })
})

router.get('/:id/usage', (req: Request, res: Response): void => {
  const material = db.prepare('SELECT * FROM material_batches WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined
  if (!material) {
    res.status(404).json({ success: false, error: '材料不存在' })
    return
  }

  const batchNumber = material.batch_number as string

  const rows = db.prepare(`
    SELECT rs.* FROM material_batches mb
    JOIN restoration_steps rs ON mb.step_id = rs.id
    WHERE mb.batch_number = ?
    ORDER BY rs.restoration_id, rs.step_order
  `).all(batchNumber) as Record<string, unknown>[]

  res.json({ success: true, data: rows.map(toCamelCase) })
})

export default router
