import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

router.post('/:id/review', (req: Request, res: Response): void => {
  const { id: batchId } = req.params
  const { resultId, status, reviewer, remark } = req.body
  if (!resultId || !status || !reviewer) {
    res.status(400).json({ success: false, error: 'resultId, status and reviewer are required' })
    return
  }
  const review = db.prepare('SELECT * FROM review_records WHERE result_id = ? AND batch_id = ?').get(resultId, batchId) as any
  if (!review) {
    res.status(404).json({ success: false, error: 'Review record not found' })
    return
  }

  const now = new Date().toISOString()
  db.prepare(
    `UPDATE review_records SET status = ?, reviewer = ?, reviewed_at = ?, remark = ? WHERE result_id = ? AND batch_id = ?`
  ).run(status, reviewer, now, remark || null, resultId, batchId)

  const pendingCount = (db.prepare(
    "SELECT COUNT(*) as count FROM review_records WHERE batch_id = ? AND status = '待复核'"
  ).get(batchId) as any).count

  if (pendingCount === 0 && status === '已复核') {
    db.prepare("UPDATE batches SET status = 'reviewed' WHERE id = ?").run(batchId)
  }

  const updated = db.prepare('SELECT * FROM review_records WHERE result_id = ? AND batch_id = ?').get(resultId, batchId) as any
  res.json({
    success: true,
    data: {
      id: updated.id,
      batchId: updated.batch_id,
      resultId: updated.result_id,
      status: updated.status,
      reviewer: updated.reviewer,
      reviewedAt: updated.reviewed_at,
      remark: updated.remark,
    },
  })
})

router.get('/:id/reviews', (req: Request, res: Response): void => {
  const { id: batchId } = req.params
  const rows = db.prepare('SELECT * FROM review_records WHERE batch_id = ?').all(batchId) as any[]
  const data = rows.map((row) => ({
    id: row.id,
    batchId: row.batch_id,
    resultId: row.result_id,
    status: row.status,
    reviewer: row.reviewer,
    reviewedAt: row.reviewed_at,
    remark: row.remark,
  }))
  res.json({ success: true, data })
})

export default router
