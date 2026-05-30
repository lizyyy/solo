import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

function mapCollateral(row: any) {
  return {
    id: row.id,
    batchId: row.batch_id,
    tradeId: row.trade_id,
    bondCode: row.bond_code,
    bondName: row.bond_name,
    faceValue: row.face_value,
    quantity: row.quantity,
    maturityDate: row.maturity_date,
    replacementBondCode: row.replacement_bond_code,
    replacementStatus: row.replacement_status,
    source: row.source,
    version: row.version,
  }
}

router.post('/:id/collaterals', (req: Request, res: Response): void => {
  const { id: batchId } = req.params
  const { tradeId, bondCode, bondName, faceValue, quantity, maturityDate, replacementBondCode, replacementStatus, source } = req.body
  if (!tradeId || !bondCode || !bondName || faceValue == null || quantity == null || !maturityDate) {
    res.status(400).json({ success: false, error: 'Missing required fields' })
    return
  }
  const batch = db.prepare('SELECT id FROM batches WHERE id = ?').get(batchId)
  if (!batch) {
    res.status(404).json({ success: false, error: 'Batch not found' })
    return
  }
  const cid = uuidv4()
  db.prepare(
    `INSERT INTO collaterals (id, batch_id, trade_id, bond_code, bond_name, face_value, quantity, maturity_date, replacement_bond_code, replacement_status, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(cid, batchId, tradeId, bondCode, bondName, faceValue, quantity, maturityDate, replacementBondCode || null, replacementStatus || '无替换', source || '')
  const row = db.prepare('SELECT * FROM collaterals WHERE id = ?').get(cid) as any
  res.status(201).json({ success: true, data: mapCollateral(row) })
})

router.get('/:id/collaterals', (req: Request, res: Response): void => {
  const { id: batchId } = req.params
  const rows = db.prepare('SELECT * FROM collaterals WHERE batch_id = ?').all(batchId) as any[]
  const data = rows.map(mapCollateral)
  res.json({ success: true, data })
})

router.put('/:id/collaterals/:cid', (req: Request, res: Response): void => {
  const { id: batchId, cid } = req.params
  const collateral = db.prepare('SELECT * FROM collaterals WHERE id = ? AND batch_id = ?').get(cid, batchId) as any
  if (!collateral) {
    res.status(404).json({ success: false, error: 'Collateral not found' })
    return
  }
  const { tradeId, bondCode, bondName, faceValue, quantity, maturityDate, replacementBondCode, replacementStatus, source } = req.body
  db.prepare(
    `UPDATE collaterals SET trade_id = ?, bond_code = ?, bond_name = ?, face_value = ?, quantity = ?, maturity_date = ?, replacement_bond_code = ?, replacement_status = ?, source = ?, version = version + 1 WHERE id = ?`
  ).run(
    tradeId ?? collateral.trade_id,
    bondCode ?? collateral.bond_code,
    bondName ?? collateral.bond_name,
    faceValue ?? collateral.face_value,
    quantity ?? collateral.quantity,
    maturityDate ?? collateral.maturity_date,
    replacementBondCode ?? collateral.replacement_bond_code,
    replacementStatus ?? collateral.replacement_status,
    source ?? collateral.source,
    cid
  )
  const updated = db.prepare('SELECT * FROM collaterals WHERE id = ?').get(cid) as any
  res.json({ success: true, data: mapCollateral(updated) })
})

router.delete('/:id/collaterals/:cid', (req: Request, res: Response): void => {
  const { id: batchId, cid } = req.params
  const result = db.prepare('DELETE FROM collaterals WHERE id = ? AND batch_id = ?').run(cid, batchId)
  if (result.changes === 0) {
    res.status(404).json({ success: false, error: 'Collateral not found' })
    return
  }
  res.json({ success: true })
})

export default router
