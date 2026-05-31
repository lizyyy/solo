import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const { modelId, date, severity, search } = req.query

    let sql = `
      SELECT r.*, m.name as model_name
      FROM reports r
      LEFT JOIN models m ON r.model_id = m.id
      WHERE 1=1
    `
    const params: unknown[] = []

    if (modelId) {
      sql += ' AND r.model_id = ?'
      params.push(modelId)
    }
    if (date) {
      sql += ' AND r.date = ?'
      params.push(date)
    }
    if (severity) {
      sql += ' AND r.severity = ?'
      params.push(severity)
    }
    if (search) {
      sql += ` AND r.id IN (SELECT report_id FROM conclusions WHERE title LIKE ? OR description LIKE ?)`
      params.push(`%${search}%`, `%${search}%`)
    }

    sql += ' ORDER BY r.date DESC, r.created_at DESC'

    const reports = db.prepare(sql).all(...params)
    res.json({ success: true, data: reports })
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器内部错误' })
  }
})

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const report = db.prepare(`
      SELECT r.*, m.name as model_name
      FROM reports r
      LEFT JOIN models m ON r.model_id = m.id
      WHERE r.id = ?
    `).get(req.params.id)

    if (!report) {
      res.status(404).json({ success: false, error: '报告不存在' })
      return
    }

    const conclusions = db.prepare(
      'SELECT * FROM conclusions WHERE report_id = ?'
    ).all(req.params.id) as { id: string }[]

    const conclusionsWithSources = conclusions.map((c) => {
      const sources = db.prepare(
        'SELECT * FROM conclusion_sources WHERE conclusion_id = ?'
      ).all(c.id)
      return { ...c, sources }
    })

    const evaluations = db.prepare(
      'SELECT * FROM evaluations WHERE report_id = ?'
    ).all(req.params.id)

    const changeHistory = db.prepare(
      'SELECT * FROM change_history WHERE report_id = ? ORDER BY operated_at DESC'
    ).all(req.params.id)

    res.json({
      success: true,
      data: {
        report,
        conclusions: conclusionsWithSources,
        evaluations,
        changeHistory,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器内部错误' })
  }
})

router.post('/', (req: Request, res: Response): void => {
  try {
    const { date, modelId, severity, bundleId } = req.body

    if (!date || !modelId || !severity) {
      res.status(400).json({ success: false, error: '缺少必要字段：date, modelId, severity' })
      return
    }

    const model = db.prepare('SELECT * FROM models WHERE id = ?').get(modelId)
    if (!model) {
      res.status(404).json({ success: false, error: '模型不存在' })
      return
    }

    const reportId = uuidv4()
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

    db.prepare(
      'INSERT INTO reports (id, date, model_id, severity, bundle_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(reportId, date, modelId, severity, bundleId || null, now, now)

    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId)
    res.status(201).json({ success: true, data: report })
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器内部错误' })
  }
})

export default router
