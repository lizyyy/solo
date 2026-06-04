import { Router, type Request, type Response } from 'express'
import db from '../database.js'

function toCamelCase(status: any): any {
  return {
    rawRowImported: !!status.raw_row_imported,
    rawRowImportedAt: status.raw_row_imported_at,
    boundaryReviewed: !!status.boundary_reviewed,
    boundaryReviewedAt: status.boundary_reviewed_at,
    calculationUpdated: !!status.calculation_updated,
    calculationUpdatedAt: status.calculation_updated_at,
  }
}

const router = Router()

router.get('/status', (req: Request, res: Response): void => {
  try {
    const status = db.prepare('SELECT * FROM workflow_status WHERE id = ?').get('1') as any
    res.json({ success: true, data: toCamelCase(status) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/advance', (req: Request, res: Response): void => {
  try {
    const { step } = req.body
    const stepMap: Record<string, { field: string; atField: string }> = {
      rawRowImported: { field: 'raw_row_imported', atField: 'raw_row_imported_at' },
      boundaryReviewed: { field: 'boundary_reviewed', atField: 'boundary_reviewed_at' },
      calculationUpdated: { field: 'calculation_updated', atField: 'calculation_updated_at' },
    }

    const mapping = stepMap[step]
    if (!mapping) {
      res.status(400).json({ success: false, error: 'Invalid step' })
      return
    }

    db.prepare(`
      UPDATE workflow_status SET ${mapping.field} = 1, ${mapping.atField} = datetime('now') WHERE id = '1'
    `).run()

    const updated = db.prepare('SELECT * FROM workflow_status WHERE id = ?').get('1') as any
    res.json({ success: true, data: toCamelCase(updated) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
