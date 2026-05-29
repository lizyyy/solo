import { Router } from 'express'
import db from '../db.js'
import { generateAuditReport, exportAsCsv, exportAsJson } from '../services/reportGenerator.js'
import { buildFilterClause } from '../filterHelper.js'

const router = Router()

router.get('/audit', (req, res) => {
  try {
    const { where, params } = buildFilterClause(req.query)
    const report = generateAuditReport(db, where, params)
    res.json(report)
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate audit report' })
  }
})

router.patch('/annotations/:id', (req, res) => {
  try {
    const { note } = req.body
    const existing = db.prepare('SELECT id FROM callback_records WHERE id = ?').get(req.params.id)
    if (!existing) {
      res.status(404).json({ success: false, error: 'Callback not found' })
      return
    }

    db.prepare(
      "UPDATE callback_records SET confirm_note = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(note || null, req.params.id)

    const updated = db.prepare('SELECT * FROM callback_records WHERE id = ?').get(req.params.id)
    res.json(updated)
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update annotation' })
  }
})

router.get('/export', (req, res) => {
  try {
    const format = (req.query.format as string) || 'csv'
    const { where, params } = buildFilterClause(req.query)
    const whereClause = where ? ` WHERE ${where}` : ''

    const records = db.prepare(`SELECT * FROM callback_records${whereClause} ORDER BY timestamp DESC`).all(...params) as any[]

    if (format === 'json') {
      const content = exportAsJson(records)
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', 'attachment; filename=audit-report.json')
      res.send(content)
    } else {
      const content = exportAsCsv(records)
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', 'attachment; filename=audit-report.csv')
      res.send(content)
    }
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to export data' })
  }
})

export default router
