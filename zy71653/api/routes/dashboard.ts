import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

router.get('/', (_req: Request, res: Response): void => {
  const channels = db.prepare(`
    SELECT COUNT(*) as count FROM channels WHERE status = 'active'
  `).get() as any

  const totalBudget = db.prepare(`
    SELECT COALESCE(SUM(total_budget), 0) as total FROM budgets
  `).get() as any

  const totalSpent = db.prepare(`
    SELECT COALESCE(SUM(spent), 0) as total FROM budgets
  `).get() as any

  const totalRemaining = db.prepare(`
    SELECT COALESCE(SUM(remaining), 0) as total FROM budgets
  `).get() as any

  const allocatedCount = db.prepare(`
    SELECT COUNT(*) as count FROM allocations WHERE status IN ('pending', 'applied')
  `).get() as any

  const pendingCount = db.prepare(`
    SELECT COUNT(*) as count FROM allocations WHERE status = 'pending'
  `).get() as any

  const openExceptions = db.prepare(`
    SELECT COUNT(*) as count FROM exceptions WHERE status = 'open'
  `).get() as any

  const highSeverityExceptions = db.prepare(`
    SELECT COUNT(*) as count FROM exceptions WHERE status = 'open' AND severity = 'high'
  `).get() as any

  const exceptionByType = db.prepare(`
    SELECT type, COUNT(*) as count FROM exceptions WHERE status = 'open' GROUP BY type
  `).all() as any[]

  const channelHealth = db.prepare(`
    SELECT c.id, c.name, c.platform, c.conversion_rate, c.fatigue_score, c.spend_velocity,
      COALESCE(SUM(cv.conversions), 0) as total_conversions,
      COALESCE(SUM(cv.cost), 0) as total_cost,
      COALESCE(SUM(cv.revenue), 0) as total_revenue,
      CASE
        WHEN c.fatigue_score > 0.6 THEN 'warning'
        WHEN c.conversion_rate < 0.025 THEN 'low'
        ELSE 'healthy'
      END as health_status
    FROM channels c
    LEFT JOIN conversions cv ON cv.channel_id = c.id
    WHERE c.status = 'active'
    GROUP BY c.id
    ORDER BY c.name
  `).all() as any[]

  const recentExceptions = db.prepare(`
    SELECT * FROM exceptions WHERE status = 'open' ORDER BY created_at DESC LIMIT 5
  `).all() as any[]

  const campaigns = db.prepare(`
    SELECT b.campaign_id, b.total_budget, b.spent, b.remaining, b.period_start, b.period_end,
      COUNT(a.id) as allocation_count
    FROM budgets b
    LEFT JOIN allocations a ON a.campaign_id = b.campaign_id AND a.status IN ('pending', 'applied')
    GROUP BY b.campaign_id
    ORDER BY b.period_end DESC
  `).all() as any[]

  const pendingAllocations = db.prepare(`
    SELECT a.id, a.campaign_id, a.channel_id, a.suggested_budget, a.created_at,
      c.name as channel_name
    FROM allocations a
    LEFT JOIN channels c ON c.id = a.channel_id
    WHERE a.status = 'pending'
    ORDER BY a.created_at DESC
    LIMIT 10
  `).all() as any[]

  const pendingItems = [
    ...pendingAllocations.map(a => ({
      id: a.id,
      type: '待分配确认',
      message: `${a.channel_name} 预算分配待确认`,
      createdAt: a.created_at,
    })),
    ...recentExceptions.filter(e => e.severity === 'high' || e.severity === 'critical').slice(0, 5).map(e => ({
      id: e.id,
      type: '异常待处理',
      message: e.message,
      createdAt: e.created_at,
    })),
  ]

  const exceptionByTypeResult = Object.fromEntries(exceptionByType.map(r => [r.type, r.count]))

  res.json({
    success: true,
    data: {
      totalBudget: totalBudget.total,
      allocatedBudget: totalSpent.total,
      unallocatedCount: channels.count - allocatedCount.count,
      exceptionStats: {
        critical: highSeverityExceptions.count,
        warning: exceptionByTypeResult.conversion_delay || 0,
        info: exceptionByTypeResult.fatigue_missing || 0,
      },
      channelHealth: channelHealth.map(ch => ({
        channelId: ch.id,
        channelName: ch.name,
        conversion_rate: ch.conversion_rate,
        fatigue_score: ch.fatigue_score,
        spend_velocity: ch.spend_velocity,
      })),
      pendingItems,
      recentExceptions: recentExceptions.map(e => ({
        ...e,
        severity: e.severity === 'high' ? 'critical' : e.severity === 'medium' ? 'warning' : 'info',
      })),
      overview: {
        totalBudget: totalBudget.total,
        totalSpent: totalSpent.total,
        totalRemaining: totalRemaining.total,
        activeChannels: channels.count,
        allocatedCount: allocatedCount.count,
        pendingAllocations: pendingCount.count,
        openExceptions: openExceptions.count,
        highSeverityExceptions: highSeverityExceptions.count,
      },
      campaigns: campaigns.map(c => ({
        id: c.campaign_id,
        name: c.campaign_id === 'camp_618' ? '618大促' : c.campaign_id === 'camp_brand' ? '品牌日' : c.campaign_id,
        totalBudget: c.total_budget,
        spent: c.spent,
        remaining: c.remaining,
        periodStart: c.period_start,
        periodEnd: c.period_end,
      })),
    },
  })
})

export default router
