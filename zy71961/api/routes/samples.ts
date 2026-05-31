import { Router, type Request, type Response } from 'express'
import { db } from '../db.js'

const router = Router()

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const sample = db.prepare(`
      SELECT s.*, m.name as model_name
      FROM annotation_samples s
      LEFT JOIN models m ON s.model_id = m.id
      WHERE s.id = ?
    `).get(req.params.id)

    if (!sample) {
      res.status(404).json({ success: false, error: '标注样本不存在' })
      return
    }

    const linkedRecords = db.prepare(
      'SELECT * FROM records WHERE linked_sample_id = ?'
    ).all(req.params.id)

    const linkedSources = db.prepare(
      'SELECT cs.*, c.title as conclusion_title, c.report_id FROM conclusion_sources cs LEFT JOIN conclusions c ON cs.conclusion_id = c.id WHERE cs.sample_id = ?'
    ).all(req.params.id)

    res.json({
      success: true,
      data: { sample, linkedRecords, linkedSources },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器内部错误' })
  }
})

export default router
