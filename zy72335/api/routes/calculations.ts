import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../database.js'

function toCamelCase(calc: any): any {
  return {
    id: calc.id,
    rawRowId: calc.raw_row_id,
    kept: !!calc.kept,
    keepReason: calc.keep_reason,
    missingMaterials: JSON.parse(calc.missing_materials || '[]'),
    nextAction: calc.next_action,
    mixedFormatFlagged: !!calc.mixed_format_flagged,
    reviewStatus: calc.review_status,
    reviewedBy: calc.reviewed_by,
    reviewedAt: calc.reviewed_at,
    createdAt: calc.created_at,
    updatedAt: calc.updated_at,
  }
}

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const { reviewStatus, mixedFormatFlagged } = req.query
    let sql = 'SELECT * FROM calculation_details WHERE 1=1'
    const params: any[] = []

    if (reviewStatus) {
      sql += ' AND review_status = ?'
      params.push(reviewStatus)
    }

    if (mixedFormatFlagged === 'true') {
      sql += ' AND mixed_format_flagged = 1'
    }

    sql += ' ORDER BY created_at DESC'
    const rows = db.prepare(sql).all(...params) as any[]
    res.json({ success: true, data: rows.map(toCamelCase) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/:id/review', (req: Request, res: Response): void => {
  try {
    const { reviewStatus, reviewedBy } = req.body
    if (!reviewStatus || !reviewedBy) {
      res.status(400).json({ success: false, error: 'Missing reviewStatus or reviewedBy' })
      return
    }

    if (!['confirmed', 'rejected'].includes(reviewStatus)) {
      res.status(400).json({ success: false, error: 'Invalid reviewStatus' })
      return
    }

    const existing = db.prepare('SELECT * FROM calculation_details WHERE id = ?').get(req.params.id) as any
    if (!existing) {
      res.status(404).json({ success: false, error: 'Calculation detail not found' })
      return
    }

    db.prepare(`
      UPDATE calculation_details
      SET review_status = ?, reviewed_by = ?, reviewed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(reviewStatus, reviewedBy, req.params.id)

    const updated = db.prepare('SELECT * FROM calculation_details WHERE id = ?').get(req.params.id) as any
    res.json({ success: true, data: toCamelCase(updated) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/refresh', (req: Request, res: Response): void => {
  try {
    const rawRows = db.prepare(`
      SELECT r.*, b.id AS boundary_id_exists
      FROM raw_rows r
      LEFT JOIN boundary_specs b ON b.raw_row_id = r.id
      WHERE r.id NOT IN (SELECT raw_row_id FROM calculation_details)
    `).all() as any[]

    const insertStmt = db.prepare(`
      INSERT INTO calculation_details (id, raw_row_id, kept, keep_reason, missing_materials, next_action, mixed_format_flagged)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    const transaction = db.transaction(() => {
      for (const row of rawRows) {
        const hasBoundary = !!row.boundary_id_exists
        const mixedFlagged = row.has_mixed_format ? 1 : 0
        const kept = 1
        const keepReason = hasBoundary ? 'Boundary spec available' : 'No boundary spec'
        const missingMaterials = hasBoundary ? '[]' : JSON.stringify([row.content])
        const nextAction = hasBoundary ? 'no_action' : (row.has_mixed_format ? 'contact_activity_leader' : 'contact_coach')

        insertStmt.run(uuidv4(), row.id, kept, keepReason, missingMaterials, nextAction, mixedFlagged)
      }
    })

    transaction()

    res.json({ success: true, data: { generated: rawRows.length } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
