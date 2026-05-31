import { Router, type Request, type Response } from 'express'
import { getDb } from '../database.js'
import { getRecords } from '../services/recordService.js'
import { getRecentAnomalies } from '../services/auditService.js'
import type { DashboardStats, RecordRow } from '../types.js'

const router = Router()

router.get('/stats', (_req: Request, res: Response): void => {
  const db = getDb()

  const today = new Date().toISOString().slice(0, 10)
  const todayRow = db.prepare('SELECT COUNT(*) as count FROM inspection_records WHERE flight_date = ?').get(today) as { count: number }
  const todayInspections = todayRow.count

  const totalRow = db.prepare('SELECT COUNT(*) as count FROM inspection_records').get() as { count: number }
  const anomalyRow = db.prepare("SELECT COUNT(*) as count FROM inspection_records WHERE status IN ('warning','critical')").get() as { count: number }
  const anomalyRate = totalRow.count > 0 ? Math.round((anomalyRow.count / totalRow.count) * 10000) / 100 : 0

  const pendingRow = db.prepare("SELECT COUNT(*) as count FROM inspection_records WHERE status IN ('warning','critical') AND id NOT IN (SELECT DISTINCT record_id FROM judgments WHERE confirmed = 1)").get() as { count: number }
  const pendingCount = pendingRow.count

  const noFlyRow = db.prepare("SELECT COUNT(*) as count FROM judgments WHERE rule_type = 'no_fly_zone'").get() as { count: number }
  const noFlyZoneEdges = noFlyRow.count

  const recentAnomalies = getRecentAnomalies(24, 10)

  const pendingRecords = db.prepare(`
    SELECT * FROM inspection_records
    WHERE status IN ('warning','critical')
    ORDER BY updated_at DESC
    LIMIT 10
  `).all() as RecordRow[]

  const pendingTasks = pendingRecords.map(r => {
    const judgments = db.prepare('SELECT * FROM judgments WHERE record_id = ? AND confirmed = 0').all(r.id) as any[]
    return {
      id: r.id,
      towerId: r.tower_id,
      towerName: r.tower_name,
      flightDate: r.flight_date,
      flightTime: r.flight_time,
      pilotName: r.pilot_name,
      status: r.status,
      judgments: judgments.map(j => ({
        id: j.id,
        recordId: j.record_id,
        ruleName: j.rule_name,
        ruleType: j.rule_type,
        triggeredAt: j.triggered_at,
        matchedData: JSON.parse(j.matched_data || '{}'),
        conclusion: j.conclusion,
        reasoning: j.reasoning,
        suggestedAction: j.suggested_action,
        severity: j.severity,
        confirmed: j.confirmed === 1,
      })),
      attachments: [],
      corrections: [],
      auditTrail: [],
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  })

  const stats: DashboardStats = {
    todayInspections,
    anomalyRate,
    pendingCount,
    noFlyZoneEdges,
    recentAnomalies,
    pendingTasks,
  }

  res.json({ success: true, data: stats })
})

export default router
