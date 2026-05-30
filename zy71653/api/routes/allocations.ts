import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import {
  generateSuggestions,
  applyAllocation,
  rollbackAllocation,
  compareScenarios,
} from '../services/allocationEngine.js'

const router = Router()

router.post('/generate', (req: Request, res: Response): void => {
  const { campaignId, totalBudget } = req.body

  if (!campaignId) {
    res.status(400).json({ success: false, error: 'campaignId为必填项' })
    return
  }

  const budget = totalBudget || (() => {
    const row = db.prepare(`
      SELECT total_budget FROM budgets WHERE campaign_id = ? ORDER BY period_end DESC LIMIT 1
    `).get(campaignId) as any
    return row ? row.total_budget : 0
  })()

  if (budget <= 0) {
    res.status(400).json({ success: false, error: '预算金额必须大于0' })
    return
  }

  const suggestions = generateSuggestions(campaignId, budget)
  res.json({ success: true, data: { campaignId, totalBudget: budget, suggestions } })
})

router.post('/apply', (req: Request, res: Response): void => {
  const { campaignId, suggestions, overrides } = req.body

  if (!campaignId || !suggestions || !Array.isArray(suggestions)) {
    res.status(400).json({ success: false, error: 'campaignId和suggestions为必填项' })
    return
  }

  try {
    const results = applyAllocation(campaignId, suggestions, overrides)
    res.json({ success: true, data: results })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/rollback/:id', (req: Request, res: Response): void => {
  const { id } = req.params
  const { reason } = req.body

  if (!reason) {
    res.status(400).json({ success: false, error: '回退原因为必填项' })
    return
  }

  try {
    const result = rollbackAllocation(id, reason)
    res.json({ success: true, data: result })
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message })
  }
})

router.post('/compare', (req: Request, res: Response): void => {
  const { campaignId, scenarioAOverrides, scenarioBOverrides } = req.body

  if (!campaignId) {
    res.status(400).json({ success: false, error: 'campaignId为必填项' })
    return
  }

  try {
    const comparison = compareScenarios(
      campaignId,
      scenarioAOverrides || {},
      scenarioBOverrides || {}
    )
    res.json({ success: true, data: comparison })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/campaign/:campaignId', (req: Request, res: Response): void => {
  const { campaignId } = req.params

  const allocations = db.prepare(`
    SELECT a.*, c.name as channel_name, c.platform, c.conversion_rate, c.fatigue_score
    FROM allocations a
    LEFT JOIN channels c ON a.channel_id = c.id
    WHERE a.campaign_id = ?
    ORDER BY a.created_at DESC
  `).all(campaignId)

  res.json({ success: true, data: allocations })
})

router.get('/versions/:allocationId', (req: Request, res: Response): void => {
  const { allocationId } = req.params

  const versions = db.prepare(`
    SELECT * FROM allocation_versions
    WHERE allocation_id = ?
    ORDER BY created_at DESC
  `).all(allocationId)

  res.json({ success: true, data: versions })
})

export default router
