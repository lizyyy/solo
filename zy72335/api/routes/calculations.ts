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
    const { reviewStatus, reviewedBy, reason } = req.body
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

    const oldStatus = existing.review_status || 'pending'
    const statusChanged = oldStatus !== reviewStatus

    const transaction = db.transaction(() => {
      db.prepare(`
        UPDATE calculation_details
        SET review_status = ?, reviewed_by = ?, reviewed_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(reviewStatus, reviewedBy, req.params.id)

      if (statusChanged) {
        const affected: string[] = [`raw_row:${existing.raw_row_id}`]
        db.prepare(`
          INSERT INTO change_records (id, entity_type, entity_id, field_name, old_value, new_value, reason, changed_by, affected_results)
          VALUES (?, 'calculation', ?, '复核状态', ?, ?, ?, ?, ?)
        `).run(
          uuidv4(),
          req.params.id,
          oldStatus,
          reviewStatus,
          reason || '复核状态变更',
          reviewedBy,
          JSON.stringify(affected)
        )
      }
    })

    transaction()

    const updated = db.prepare('SELECT * FROM calculation_details WHERE id = ?').get(req.params.id) as any
    res.json({ success: true, data: toCamelCase(updated) })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/refresh', (req: Request, res: Response): void => {
  try {
    const rawRows = db.prepare(`
      SELECT r.*,
             b.id AS boundary_id, b.field_name, b.min_value, b.max_value, b.unit, b.description
      FROM raw_rows r
      LEFT JOIN boundary_specs b ON b.raw_row_id = r.id
    `).all() as any[]

    db.prepare('DELETE FROM calculation_details').run()

    const insertStmt = db.prepare(`
      INSERT INTO calculation_details (id, raw_row_id, kept, keep_reason, missing_materials, next_action, mixed_format_flagged)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    const transaction = db.transaction(() => {
      for (const row of rawRows) {
        const hasBoundary = !!row.boundary_id
        const mixedFlagged = row.has_mixed_format ? 1 : 0
        const kept = 1

        const pct = row.percentage_value ? String(row.percentage_value) : '—'
        const dec = row.decimal_value ? String(row.decimal_value) : '—'
        const fn = row.field_name ? String(row.field_name) : '未命名字段'
        const unit = row.unit ? String(row.unit) : ''
        const minV = row.min_value
        const maxV = row.max_value

        let keepReason: string
        const missing: string[] = []
        let nextAction: string

        if (hasBoundary) {
          const rangeDesc = (minV !== null && minV !== undefined) || (maxV !== null && maxV !== undefined)
            ? `[${minV ?? '—'}-${maxV ?? '—'}]${unit}`
            : `无明确数值范围`
          keepReason = `${row.content}：${fn}为${pct}${unit ? '/' : ''}${dec}${unit ? ' ' + unit : ''}，已关联${rangeDesc}的边界值说明，${row.description ? '备注：' + row.description : '符合模拟退火保留规则'}`

          if (row.has_mixed_format) {
            missing.push(`「${row.content}」同时记录了百分数(${pct})和小数(${dec})两种格式，需要联系活动负责人确认原始录入口径`)
            nextAction = 'contact_activity_leader'
          } else {
            nextAction = 'no_action'
          }
        } else {
          keepReason = `${row.content}：尚未补录「${fn}」的边界值说明，暂按模拟退火默认规则保留，待竞赛教练唐老师补充边界阈值后重新判定`
          missing.push(`缺少「${row.content}」的边界值说明(${fn}的上下限、单位和判定规则)，需要竞赛教练唐老师根据竞赛规则补录`)
          if (row.has_mixed_format) {
            missing.push(`同时存在百分数(${pct})和小数(${dec})两种录入格式，需活动负责人和唐老师共同确认`)
          }
          nextAction = 'contact_coach'
        }

        insertStmt.run(
          uuidv4(),
          row.id,
          kept,
          keepReason,
          JSON.stringify(missing),
          nextAction,
          mixedFlagged
        )
      }
    })

    transaction()

    res.json({ success: true, data: { generated: rawRows.length } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
