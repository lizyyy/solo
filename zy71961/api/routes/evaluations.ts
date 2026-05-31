import { Router, type Request, type Response } from 'express'
import { db } from '../db.js'

const router = Router()

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const evaluation = db.prepare(`
      SELECT e.*, m.name as model_name
      FROM evaluations e
      LEFT JOIN models m ON e.model_id = m.id
      WHERE e.id = ?
    `).get(req.params.id)

    if (!evaluation) {
      res.status(404).json({ success: false, error: '评估记录不存在' })
      return
    }

    const linkedRecords = db.prepare(
      'SELECT * FROM records WHERE linked_evaluation_id = ?'
    ).all(req.params.id)

    const linkedSources = db.prepare(
      'SELECT cs.*, c.title as conclusion_title, c.report_id FROM conclusion_sources cs LEFT JOIN conclusions c ON cs.conclusion_id = c.id WHERE cs.evaluation_id = ?'
    ).all(req.params.id)

    res.json({
      success: true,
      data: { evaluation, linkedRecords, linkedSources },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器内部错误' })
  }
})

export default router
