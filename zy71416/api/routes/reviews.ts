import { Router, type Request, type Response } from 'express'
import { randomUUID } from 'crypto'
import db from '../database.js'
import type { ReviewResult } from '../../shared/types.js'

const router = Router()

router.post('/', (req: Request, res: Response): void => {
  try {
    const { transactionId, reviewer, decision, comment } = req.body

    if (!transactionId || !reviewer || !decision) {
      res.status(400).json({ success: false, error: '缺少必填字段' })
      return
    }

    const txn = db.prepare('SELECT id FROM transactions WHERE id = ?').get(transactionId)
    if (!txn) {
      res.status(404).json({ success: false, error: '交易不存在' })
      return
    }

    const existing = db.prepare('SELECT id FROM review_results WHERE transactionId = ?').get(transactionId) as any

    let result: ReviewResult

    if (existing) {
      db.prepare(
        'UPDATE review_results SET reviewer = ?, decision = ?, comment = ? WHERE transactionId = ?'
      ).run(reviewer, decision, comment || null, transactionId)

      result = {
        id: existing.id,
        transactionId,
        reviewer,
        decision,
        comment: comment || '',
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      }
    } else {
      const id = randomUUID()
      db.prepare(
        'INSERT INTO review_results (id, transactionId, reviewer, decision, comment) VALUES (?, ?, ?, ?, ?)'
      ).run(id, transactionId, reviewer, decision, comment || null)

      result = {
        id,
        transactionId,
        reviewer,
        decision,
        comment: comment || '',
        createdAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
      }
    }

    res.status(201).json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/', (_req: Request, res: Response): void => {
  try {
    const rows = db.prepare(`
      SELECT r.*, t.cardNo, t.amount, t.merchantName, t.mcc, t.status as transactionStatus
      FROM review_results r
      LEFT JOIN transactions t ON r.transactionId = t.id
      ORDER BY r.createdAt DESC
    `).all() as any[]

    const data = rows.map(row => ({
      id: row.id,
      transactionId: row.transactionId,
      reviewer: row.reviewer,
      decision: row.decision,
      comment: row.comment || '',
      createdAt: row.createdAt,
      transaction: {
        cardNo: row.cardNo,
        amount: row.amount,
        merchantName: row.merchantName,
        mcc: row.mcc,
        status: row.transactionStatus,
      },
    }))

    res.json({ success: true, data })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
