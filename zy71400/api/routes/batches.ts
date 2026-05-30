import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

router.post('/', (req: Request, res: Response): void => {
  const { name, date } = req.body
  if (!name || !date) {
    res.status(400).json({ success: false, error: 'name and date are required' })
    return
  }
  const id = uuidv4()
  db.prepare(
    'INSERT INTO batches (id, name, date) VALUES (?, ?, ?)'
  ).run(id, name, date)
  const row = db.prepare('SELECT * FROM batches WHERE id = ?').get(id) as any
  res.status(201).json({
    success: true,
    data: {
      id: row.id,
      name: row.name,
      date: row.date,
      status: row.status,
      createdAt: row.created_at,
    },
  })
})

router.get('/', (_req: Request, res: Response): void => {
  const rows = db.prepare('SELECT * FROM batches ORDER BY created_at DESC').all() as any[]
  const data = rows.map((row) => ({
    id: row.id,
    name: row.name,
    date: row.date,
    status: row.status,
    createdAt: row.created_at,
  }))
  res.json({ success: true, data })
})

router.get('/:id', (req: Request, res: Response): void => {
  const { id } = req.params
  const row = db.prepare('SELECT * FROM batches WHERE id = ?').get(id) as any
  if (!row) {
    res.status(404).json({ success: false, error: 'Batch not found' })
    return
  }
  const tradeCount = (db.prepare('SELECT COUNT(*) as count FROM trades WHERE batch_id = ?').get(id) as any).count
  const collateralCount = (db.prepare('SELECT COUNT(*) as count FROM collaterals WHERE batch_id = ?').get(id) as any).count
  const rateCount = (db.prepare('SELECT COUNT(*) as count FROM discount_rates WHERE batch_id = ?').get(id) as any).count
  const resultCount = (db.prepare('SELECT COUNT(*) as count FROM process_results WHERE batch_id = ?').get(id) as any).count
  res.json({
    success: true,
    data: {
      id: row.id,
      name: row.name,
      date: row.date,
      status: row.status,
      createdAt: row.created_at,
      tradeCount,
      collateralCount,
      rateCount,
      resultCount,
    },
  })
})

export default router
