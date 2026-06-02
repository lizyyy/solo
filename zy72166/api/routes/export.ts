import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

router.get('/:id/export', (req: Request, res: Response): void => {
  try {
    const items = db.prepare(`
      SELECT ei.*, ir.period, ir.source
      FROM export_items ei
      JOIN import_records ir ON ei.record_id = ir.id
      WHERE ei.project_id = ?
      ORDER BY ei.category, ei.location_name
    `).all(req.params.id)

    const grouped = {
      processed: (items as any[]).filter((i) => i.category === 'processed'),
      pending_verification: (items as any[]).filter((i) => i.category === 'pending_verification'),
      needs_field_visit: (items as any[]).filter((i) => i.category === 'needs_field_visit'),
    }

    res.json({ success: true, data: grouped })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.post('/:id/export/generate', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { operator } = req.body as { operator: string }
    if (!operator) {
      res.status(400).json({ success: false, error: '需要operator参数' })
      return
    }

    db.prepare(`DELETE FROM export_items WHERE project_id = ?`).run(id)

    const reviewItems = db.prepare(`
      SELECT ri.*, ir.location_name, ir.address, ir.sunlight_hours, ir.source
      FROM review_items ri
      JOIN import_records ir ON ri.record_id = ir.id
      WHERE ri.project_id = ? AND ri.status IN ('passed', 'failed', 'needs_field_visit')
    `).all(id) as any[]

    const insertExport = db.prepare(`
      INSERT INTO export_items (id, project_id, category, record_id, location_name, address, sunlight_hours, verdict, judgment_basis, operator, reviewed_at, handover_note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `)

    const transaction = db.transaction(() => {
      for (const item of reviewItems) {
        let category: string
        if (item.status === 'passed') category = 'processed'
        else if (item.status === 'failed') category = 'pending_verification'
        else category = 'needs_field_visit'

        const judgmentBasis = item.status === 'passed'
          ? '日照时长达标，复核通过'
          : item.status === 'failed'
            ? '日照时长未达标，需进一步核实'
            : '需要现场复看确认'

        const lastNote = db.prepare(
          `SELECT content FROM review_notes WHERE review_item_id = ? ORDER BY created_at DESC LIMIT 1`
        ).get(item.id) as any

        insertExport.run(
          uuidv4(),
          id,
          category,
          item.record_id,
          item.location_name,
          item.address,
          item.sunlight_hours,
          item.verdict,
          judgmentBasis,
          operator,
          lastNote?.content || null
        )
      }
    })

    transaction()

    db.prepare(`UPDATE projects SET status = 'exported', updated_at = datetime('now') WHERE id = ?`).run(id)

    const exportItems = db.prepare(`SELECT * FROM export_items WHERE project_id = ?`).all(id)
    res.json({ success: true, data: exportItems })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.get('/:id/export/csv', (req: Request, res: Response): void => {
  try {
    const items = db.prepare(`
      SELECT ei.*, ir.period, ir.source, ir.raw_remark
      FROM export_items ei
      JOIN import_records ir ON ei.record_id = ir.id
      WHERE ei.project_id = ?
      ORDER BY ei.category, ei.location_name
    `).all(req.params.id) as any[]

    const headers = ['分类', '点位名称', '地址', '日照时长', '判定结果', '判定依据', '操作人', '复核时间', '交接备注', '原始备注']
    const categoryMap: Record<string, string> = {
      processed: '已处理',
      pending_verification: '待核实',
      needs_field_visit: '需现场复看',
    }

    const rows = items.map((item) => [
      categoryMap[item.category] || item.category,
      item.location_name,
      item.address,
      item.sunlight_hours ?? '',
      item.verdict || '',
      item.judgment_basis,
      item.operator,
      item.reviewed_at,
      item.handover_note || '',
      item.raw_remark || '',
    ])

    const escapeCsv = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`
      }
      return val
    }

    const csvContent = [
      headers.map(escapeCsv).join(','),
      ...rows.map((row) => row.map((cell) => escapeCsv(String(cell))).join(',')),
    ].join('\n')

    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename=sunlight-review-export.csv`)
    res.send('\uFEFF' + csvContent)
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
