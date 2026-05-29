import { Router } from 'express'
import db from '../db.js'
import { generateAuditReport } from '../services/reportGenerator.js'
import { buildFilterClause } from '../filterHelper.js'

const router = Router()

router.get('/overview', (req, res) => {
  try {
    const { where, params } = buildFilterClause(req.query)
    const report = generateAuditReport(db, where, params)
    res.json(report)
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch overview stats' })
  }
})

router.get('/retry-distribution', (req, res) => {
  try {
    const { where, params } = buildFilterClause(req.query)
    const whereClause = where ? ` WHERE ${where}` : ''
    const rows = db.prepare(
      `SELECT retry_count, COUNT(*) as count FROM callback_records${whereClause} GROUP BY retry_count ORDER BY retry_count`
    ).all(...params)
    res.json({ data: rows })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch retry distribution' })
  }
})

router.get('/status-distribution', (req, res) => {
  try {
    const { where, params } = buildFilterClause(req.query)
    const whereClause = where ? ` WHERE ${where}` : ''
    const rows = db.prepare(
      `SELECT order_status as status, COUNT(*) as count FROM callback_records${whereClause} GROUP BY order_status ORDER BY count DESC`
    ).all(...params)
    res.json({ data: rows })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch status distribution' })
  }
})

router.get('/trend', (req, res) => {
  try {
    const { where, params } = buildFilterClause(req.query)
    const whereClause = where ? ` WHERE ${where}` : ''
    const rows = db.prepare(
      `SELECT DATE(timestamp) as date, COUNT(*) as total, SUM(CASE WHEN confirm_status = 'pending' OR signature_status IN ('expired', 'invalid') OR processing_result = 'duplicate' THEN 1 ELSE 0 END) as anomaly FROM callback_records${whereClause} GROUP BY DATE(timestamp) ORDER BY date`
    ).all(...params)
    res.json({ data: rows })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch trend data' })
  }
})

export default router
