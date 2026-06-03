import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db, writeAuditLog } from '../database.js'

const router = Router()

router.get('/', (_req: Request, res: Response): void => {
  const batches = db.prepare('SELECT * FROM batches ORDER BY created_at DESC').all()
  res.json({ success: true, data: batches })
})

router.post('/', (req: Request, res: Response): void => {
  const { name } = req.body
  if (!name) {
    res.status(400).json({ success: false, error: '批次名称不能为空' })
    return
  }

  const id = uuidv4()
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO batches (id, name, created_at, status, total_records, discrepancy_count, conflict_count, pending_review_count)
    VALUES (?, ?, ?, 'importing', 0, 0, 0, 0)
  `).run(id, name, now)

  writeAuditLog(id, 'batch_created', 'system', 'fund_accountant', { batchName: name })

  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(id) as any
  res.status(201).json({ success: true, data: batch })
})

router.get('/:id', (req: Request, res: Response): void => {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(req.params.id) as any
  if (!batch) {
    res.status(404).json({ success: false, error: '批次不存在' })
    return
  }

  const records = db.prepare('SELECT * FROM confirmation_records WHERE batch_id = ?').all(req.params.id)
  const discrepancies = db.prepare('SELECT * FROM discrepancies WHERE batch_id = ?').all(req.params.id)

  res.json({
    success: true,
    data: {
      ...batch,
      records,
      discrepancies,
    },
  })
})

export default router
