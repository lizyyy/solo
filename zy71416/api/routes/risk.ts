import { Router, type Request, type Response } from 'express'
import db from '../database.js'
import { runRiskCheck } from '../services/riskService.js'

const router = Router()

router.post('/check/:transactionId', (req: Request, res: Response): void => {
  try {
    const { transactionId } = req.params
    const txn = db.prepare('SELECT id FROM transactions WHERE id = ?').get(transactionId)
    if (!txn) {
      res.status(404).json({ success: false, error: '交易不存在' })
      return
    }

    const result = runRiskCheck(transactionId)
    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/check-all', (_req: Request, res: Response): void => {
  try {
    const pending = db.prepare("SELECT id FROM transactions WHERE status = 'pending'").all() as { id: string }[]
    const results: any[] = []

    for (const row of pending) {
      try {
        const result = runRiskCheck(row.id)
        results.push({ transactionId: row.id, ...result })
      } catch (err: any) {
        results.push({ transactionId: row.id, error: err.message })
      }
    }

    res.json({ success: true, data: { checked: results.length, results } })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
