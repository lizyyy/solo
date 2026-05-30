import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

function mapRate(row: any) {
  return {
    id: row.id,
    batchId: row.batch_id,
    bondCode: row.bond_code,
    rate: row.rate,
    effectiveDate: row.effective_date,
    expiryDate: row.expiry_date,
    source: row.source,
    version: row.version,
  }
}

router.post('/:id/rates', (req: Request, res: Response): void => {
  const { id: batchId } = req.params
  const { bondCode, rate, effectiveDate, expiryDate, source } = req.body
  if (!bondCode || rate == null || !effectiveDate || !expiryDate) {
    res.status(400).json({ success: false, error: 'Missing required fields' })
    return
  }
  const batch = db.prepare('SELECT id FROM batches WHERE id = ?').get(batchId)
  if (!batch) {
    res.status(404).json({ success: false, error: 'Batch not found' })
    return
  }
  const rid = uuidv4()
  db.prepare(
    'INSERT INTO discount_rates (id, batch_id, bond_code, rate, effective_date, expiry_date, source) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(rid, batchId, bondCode, rate, effectiveDate, expiryDate, source || '')
  const row = db.prepare('SELECT * FROM discount_rates WHERE id = ?').get(rid) as any
  res.status(201).json({ success: true, data: mapRate(row) })
})

router.get('/:id/rates', (req: Request, res: Response): void => {
  const { id: batchId } = req.params
  const rows = db.prepare('SELECT * FROM discount_rates WHERE batch_id = ?').all(batchId) as any[]
  const data = rows.map(mapRate)
  res.json({ success: true, data })
})

router.put('/:id/rates/:rid', (req: Request, res: Response): void => {
  const { id: batchId, rid } = req.params
  const rateRow = db.prepare('SELECT * FROM discount_rates WHERE id = ? AND batch_id = ?').get(rid, batchId) as any
  if (!rateRow) {
    res.status(404).json({ success: false, error: 'Discount rate not found' })
    return
  }
  const { bondCode, rate, effectiveDate, expiryDate, source } = req.body
  db.prepare(
    `UPDATE discount_rates SET bond_code = ?, rate = ?, effective_date = ?, expiry_date = ?, source = ?, version = version + 1 WHERE id = ?`
  ).run(
    bondCode ?? rateRow.bond_code,
    rate ?? rateRow.rate,
    effectiveDate ?? rateRow.effective_date,
    expiryDate ?? rateRow.expiry_date,
    source ?? rateRow.source,
    rid
  )
  const updated = db.prepare('SELECT * FROM discount_rates WHERE id = ?').get(rid) as any
  res.json({ success: true, data: mapRate(updated) })
})

router.delete('/:id/rates/:rid', (req: Request, res: Response): void => {
  const { id: batchId, rid } = req.params
  const result = db.prepare('DELETE FROM discount_rates WHERE id = ? AND batch_id = ?').run(rid, batchId)
  if (result.changes === 0) {
    res.status(404).json({ success: false, error: 'Discount rate not found' })
    return
  }
  res.json({ success: true })
})

export default router
