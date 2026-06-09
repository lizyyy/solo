import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../database.js'

function toCamelCase(report: any): any {
  const content = JSON.parse(report.content || '{}')
  return {
    id: report.id,
    title: report.title,
    createdAt: report.created_at,
    generatedAt: content.generatedAt || report.created_at,
    summary: content.summary || {
      totalRows: 0,
      keptCount: 0,
      flaggedCount: 0,
      missingCount: 0,
      actionRequiredCount: 0,
    },
    sections: content.sections || {
      keptItems: [],
      flaggedItems: [],
      missingMaterials: [],
      nextActions: [],
    },
  }
}

const router = Router()

router.post('/generate', (req: Request, res: Response): void => {
  try {
    const rows = db.prepare(`
      SELECT r.*, c.kept, c.keep_reason, c.missing_materials, c.next_action, c.mixed_format_flagged, c.review_status,
             b.id AS boundary_db_id, b.field_name, b.min_value, b.max_value, b.unit, b.description
      FROM raw_rows r
      LEFT JOIN calculation_details c ON c.raw_row_id = r.id
      LEFT JOIN boundary_specs b ON b.id = r.boundary_id
      ORDER BY r.created_at DESC
    `).all() as any[]

    const keptItems = rows.filter(r => r.kept === 1).map(r => ({
      id: r.id,
      content: r.content,
      keepReason: r.keep_reason || '待补充',
      boundary: r.boundary_db_id ? {
        fieldName: r.field_name,
        minValue: r.min_value,
        maxValue: r.max_value,
        unit: r.unit || '',
      } : null,
    }))

    const flaggedItems = rows.filter(r => r.mixed_format_flagged === 1).map(r => ({
      id: r.id,
      content: r.content,
      percentageValue: r.percentage_value,
      decimalValue: r.decimal_value,
      reviewStatus: r.review_status || 'pending',
    }))

    const missingMaterials = rows.filter(r => r.missing_materials && r.missing_materials !== '[]').map(r => ({
      id: r.id,
      content: r.content,
      missingMaterials: JSON.parse(r.missing_materials || '[]'),
    }))

    const nextActions = rows.filter(r => r.next_action && r.next_action !== 'no_action').map(r => ({
      id: r.id,
      content: r.content,
      nextAction: r.next_action,
    }))

    const report = {
      generatedAt: new Date().toISOString(),
      summary: {
        totalRows: rows.length,
        keptCount: keptItems.length,
        flaggedCount: flaggedItems.length,
        missingCount: missingMaterials.length,
        actionRequiredCount: nextActions.length,
      },
      sections: {
        keptItems,
        flaggedItems,
        missingMaterials,
        nextActions,
      },
    }

    const id = uuidv4()
    const title = `模拟退火座位安排复核报告 - ${new Date().toLocaleDateString('zh-CN')}`
    db.prepare(`
      INSERT INTO reports (id, title, content) VALUES (?, ?, ?)
    `).run(id, title, JSON.stringify(report))

    const saved = db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as any
    res.json({ success: true, data: toCamelCase(saved) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/', (req: Request, res: Response): void => {
  try {
    const reports = db.prepare('SELECT * FROM reports ORDER BY created_at DESC').all() as any[]
    res.json({ success: true, data: reports.map(toCamelCase) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(req.params.id) as any
    if (!report) {
      res.status(404).json({ success: false, error: 'Report not found' })
      return
    }
    res.json({ success: true, data: toCamelCase(report) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
