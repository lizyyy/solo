import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { getBatchConflicts } from '../services/conflictEngine.js'

const router = Router()

router.get('/', (_req: Request, res: Response) => {
  try {
    const reports = db.prepare(`
      SELECT fr.*, b.name AS batch_name, b.kiln_name
      FROM firing_reports fr
      LEFT JOIN batches b ON b.id = fr.batch_id
      ORDER BY fr.generated_at DESC
    `).all()
    res.json({ success: true, data: reports })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/:id', (req: Request, res: Response) => {
  try {
    const report = db.prepare(`
      SELECT fr.*, b.name AS batch_name, b.kiln_name
      FROM firing_reports fr
      LEFT JOIN batches b ON b.id = fr.batch_id
      WHERE fr.id = ?
    `).get(req.params.id) as any
    if (!report) {
      res.status(404).json({ success: false, error: '报告不存在' })
      return
    }
    report.work_details = JSON.parse(report.work_details)
    report.conflict_resolutions = JSON.parse(report.conflict_resolutions)
    res.json({ success: true, data: report })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/:id/export', (req: Request, res: Response) => {
  try {
    const { format = 'json' } = req.query as { format?: string }
    const report = db.prepare(`
      SELECT fr.*, b.name AS batch_name, b.kiln_name
      FROM firing_reports fr
      LEFT JOIN batches b ON b.id = fr.batch_id
      WHERE fr.id = ?
    `).get(req.params.id) as any
    if (!report) {
      res.status(404).json({ success: false, error: '报告不存在' })
      return
    }

    const workDetails = JSON.parse(report.work_details)
    const conflictResolutions = JSON.parse(report.conflict_resolutions)

    if (format === 'csv') {
      const headers = ['作品名称', '学员', '尺寸(宽×高×深)', '釉料', '状态']
      const rows = workDetails.map((w: any) => [
        w.name,
        w.student_name,
        `${w.width}×${w.height}×${w.depth}`,
        (w.glaze_names || '').replace(/,/g, '/'),
        w.status,
      ])

      const escapeCsv = (val: any) => {
        const str = String(val ?? '')
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }

      const csvLines = [headers.map(escapeCsv).join(',')]
      for (const row of rows) {
        csvLines.push(row.map(escapeCsv).join(','))
      }
      if (conflictResolutions.length > 0) {
        csvLines.push('')
        csvLines.push('冲突解决记录')
        csvLines.push(['作品', '原因', '操作人', '时间'].map(escapeCsv).join(','))
        for (const cr of conflictResolutions) {
          csvLines.push([cr.work_name || '', cr.reason || '', cr.operated_by || '', cr.created_at || ''].map(escapeCsv).join(','))
        }
      }

      const csvContent = '\uFEFF' + csvLines.join('\n')
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="report_${req.params.id}.csv"`)
      res.send(csvContent)
      return
    }

    report.work_details = workDetails
    report.conflict_resolutions = conflictResolutions
    res.json({ success: true, data: report })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export function generateReport(batchId: string) {
  const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(batchId) as any
  if (!batch) throw new Error('窑次不存在')
  if (batch.status !== 'completed' && batch.status !== 'firing') {
    throw new Error('仅 completed 或 firing 状态的窑次可以生成报告')
  }

  const entries = db.prepare(`
    SELECT qe.*, w.name AS work_name, w.width, w.height, w.depth, w.status AS work_status,
      s.name AS student_name,
      GROUP_CONCAT(g.name) AS glaze_names
    FROM queue_entries qe
    JOIN works w ON w.id = qe.work_id
    LEFT JOIN students s ON s.id = w.student_id
    LEFT JOIN work_glazes wg ON wg.work_id = w.id
    LEFT JOIN glazes g ON g.id = wg.glaze_id
    WHERE qe.batch_id = ?
    GROUP BY qe.id
    ORDER BY qe.position
  `).all(batchId)

  const conflicts = getBatchConflicts(batchId)

  const rescheduleLogs = db.prepare(`
    SELECT rl.*, w.name AS work_name
    FROM reschedule_logs rl
    LEFT JOIN works w ON w.id = rl.work_id
    WHERE rl.from_batch_id = ? OR rl.to_batch_id = ?
    ORDER BY rl.created_at DESC
  `).all(batchId, batchId)

  const workDetails = entries.map((e: any) => ({
    work_id: e.work_id,
    name: e.work_name,
    student_name: e.student_name,
    width: e.width,
    height: e.height,
    depth: e.depth,
    glaze_names: e.glaze_names,
    status: e.work_status,
  }))

  const conflictResolutions = rescheduleLogs.map((r: any) => ({
    work_id: r.work_id,
    work_name: r.work_name,
    reason: r.reason,
    operated_by: r.operated_by,
    created_at: r.created_at,
  }))

  const summary = `窑次：${batch.name}（${batch.kiln_name}），共 ${entries.length} 件作品，${conflicts.length} 个冲突`

  const id = uuidv4()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO firing_reports (id, batch_id, summary, work_details, conflict_resolutions, generated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, batchId, summary, JSON.stringify(workDetails), JSON.stringify(conflictResolutions), now)

  const report = db.prepare('SELECT * FROM firing_reports WHERE id = ?').get(id) as any
  report.work_details = workDetails
  report.conflict_resolutions = conflictResolutions
  return report
}

export default router
