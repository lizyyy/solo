import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

router.get('/', (_req: Request, res: Response): void => {
  const budgets = db.prepare(`
    SELECT * FROM budgets ORDER BY period_end DESC
  `).all()

  res.json({ success: true, data: budgets })
})

router.get('/campaign/:campaignId', (req: Request, res: Response): void => {
  const { campaignId } = req.params

  const budget = db.prepare(`
    SELECT * FROM budgets WHERE campaign_id = ? ORDER BY period_end DESC LIMIT 1
  `).get(campaignId) as any

  if (!budget) {
    res.status(404).json({ success: false, error: '未找到该活动的预算记录' })
    return
  }

  const allocations = db.prepare(`
    SELECT a.*, c.name as channel_name FROM allocations a
    LEFT JOIN channels c ON a.channel_id = c.id
    WHERE a.campaign_id = ? AND a.status IN ('pending', 'applied')
    ORDER BY a.created_at DESC
  `).all(campaignId)

  res.json({
    success: true,
    data: { ...budget, allocations },
  })
})

export default router
