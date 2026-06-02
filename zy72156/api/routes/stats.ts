import express, { type Request, type Response } from 'express'
import { getDb } from '../db/index.js'

const router = express.Router()
const db = getDb()

router.get('/', (_req: Request, res: Response) => {
  const locationCount = db.prepare('SELECT COUNT(*) as c FROM locations').get() as { c: number }
  const feedbackCount = db.prepare('SELECT COUNT(*) as c FROM feedback').get() as { c: number }
  const activeLocations = db.prepare(`
    SELECT COUNT(DISTINCT location_id) as c FROM feedback
  `).get() as { c: number }
  const pendingSchemes = db.prepare("SELECT COUNT(*) as c FROM schemes WHERE status = '草稿'").get() as { c: number }
  const reportCount = db.prepare('SELECT COUNT(*) as c FROM reports').get() as { c: number }
  const duplicateFeedback = db.prepare('SELECT COUNT(*) as c FROM feedback WHERE is_duplicate = 1').get() as { c: number }
  const boundaryFeedback = db.prepare('SELECT COUNT(*) as c FROM feedback WHERE is_boundary = 1').get() as { c: number }
  const driftLocations = db.prepare('SELECT COUNT(*) as c FROM locations WHERE has_coordinate_drift = 1').get() as { c: number }

  const recentFeedback = db.prepare(`
    SELECT f.*, l.canonical_name as location_name
    FROM feedback f
    JOIN locations l ON f.location_id = l.id
    ORDER BY f.reported_at DESC
    LIMIT 5
  `).all() as any[]

  const recentSchemes = db.prepare(`
    SELECT s.*, l.canonical_name as location_name
    FROM schemes s
    JOIN locations l ON s.location_id = l.id
    ORDER BY s.created_at DESC
    LIMIT 5
  `).all() as any[]

  const recentReports = db.prepare(`
    SELECT r.*, l.canonical_name as location_name
    FROM reports r
    JOIN locations l ON r.location_id = l.id
    ORDER BY r.generated_at DESC
    LIMIT 5
  `).all() as any[]

  res.json({
    success: true,
    data: {
      locations: locationCount.c,
      feedback: feedbackCount.c,
      active_locations: activeLocations.c,
      pending_schemes: pendingSchemes.c,
      reports: reportCount.c,
      duplicates: duplicateFeedback.c,
      boundary: boundaryFeedback.c,
      coordinate_drift: driftLocations.c,
      recent: {
        feedback: recentFeedback.map(f => ({ ...f, is_duplicate: f.is_duplicate === 1, is_boundary: f.is_boundary === 1 })),
        schemes: recentSchemes.map(s => ({ ...s, source_refs: JSON.parse(s.source_refs || '[]') })),
        reports: recentReports.map(r => ({ ...r, cross_period_stats: JSON.parse(r.cross_period_stats || '{}'), source_trace: JSON.parse(r.source_trace || '[]') }))
      }
    }
  })
})

export default router
