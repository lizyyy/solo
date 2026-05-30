import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

function mapTrade(row: any) {
  return {
    id: row.id,
    batchId: row.batch_id,
    direction: row.direction,
    counterparty: row.counterparty,
    amount: row.amount,
    term: row.term,
    startDate: row.start_date,
    endDate: row.end_date,
    source: row.source,
    version: row.version,
  }
}

router.post('/:id/trades', (req: Request, res: Response): void => {
  const { id: batchId } = req.params
  const { direction, counterparty, amount, term, startDate, endDate, source } = req.body
  if (!direction || !counterparty || amount == null || term == null || !startDate || !endDate) {
    res.status(400).json({ success: false, error: 'Missing required fields' })
    return
  }
  const batch = db.prepare('SELECT id FROM batches WHERE id = ?').get(batchId)
  if (!batch) {
    res.status(404).json({ success: false, error: 'Batch not found' })
    return
  }
  const tid = uuidv4()
  db.prepare(
    'INSERT INTO trades (id, batch_id, direction, counterparty, amount, term, start_date, end_date, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(tid, batchId, direction, counterparty, amount, term, startDate, endDate, source || '')
  const row = db.prepare('SELECT * FROM trades WHERE id = ?').get(tid) as any
  res.status(201).json({ success: true, data: mapTrade(row) })
})

router.get('/:id/trades', (req: Request, res: Response): void => {
  const { id: batchId } = req.params
  const rows = db.prepare('SELECT * FROM trades WHERE batch_id = ?').all(batchId) as any[]
  const data = rows.map(mapTrade)
  res.json({ success: true, data })
})

router.put('/:id/trades/:tid', (req: Request, res: Response): void => {
  const { id: batchId, tid } = req.params
  const trade = db.prepare('SELECT * FROM trades WHERE id = ? AND batch_id = ?').get(tid, batchId) as any
  if (!trade) {
    res.status(404).json({ success: false, error: 'Trade not found' })
    return
  }
  const { direction, counterparty, amount, term, startDate, endDate, source } = req.body
  db.prepare(
    `UPDATE trades SET direction = ?, counterparty = ?, amount = ?, term = ?, start_date = ?, end_date = ?, source = ?, version = version + 1 WHERE id = ?`
  ).run(
    direction ?? trade.direction,
    counterparty ?? trade.counterparty,
    amount ?? trade.amount,
    term ?? trade.term,
    startDate ?? trade.start_date,
    endDate ?? trade.end_date,
    source ?? trade.source,
    tid
  )
  const updated = db.prepare('SELECT * FROM trades WHERE id = ?').get(tid) as any
  res.json({ success: true, data: mapTrade(updated) })
})

router.delete('/:id/trades/:tid', (req: Request, res: Response): void => {
  const { id: batchId, tid } = req.params
  const result = db.prepare('DELETE FROM trades WHERE id = ? AND batch_id = ?').run(tid, batchId)
  if (result.changes === 0) {
    res.status(404).json({ success: false, error: 'Trade not found' })
    return
  }
  res.json({ success: true })
})

export default router
