import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { generateReport } from '../services/reportGenerator.js'

const router = Router()

router.post('/generate', (req: Request, res: Response): void => {
  const { format, campaignId, includeExceptions, includeHumanTips } = req.body

  if (!format || !['markdown', 'json'].includes(format)) {
    res.status(400).json({ success: false, error: 'format必须为markdown或json' })
    return
  }

  try {
    const report = generateReport({
      format,
      campaignId,
      includeExceptions: includeExceptions !== false,
      includeHumanTips: includeHumanTips !== false,
    })
    res.json({ success: true, data: report })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/', (_req: Request, res: Response): void => {
  const reports = db.prepare(`
    SELECT id, format, created_at, LENGTH(content) as content_length
    FROM reports ORDER BY created_at DESC
  `).all()

  res.json({ success: true, data: reports })
})

router.get('/:id', (req: Request, res: Response): void => {
  const { id } = req.params

  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as any
  if (!report) {
    res.status(404).json({ success: false, error: '报告不存在' })
    return
  }

  res.json({ success: true, data: report })
})

router.get('/:id/download', (req: Request, res: Response): void => {
  const { id } = req.params

  const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(id) as any
  if (!report) {
    res.status(404).json({ success: false, error: '报告不存在' })
    return
  }

  const ext = report.format === 'markdown' ? 'md' : 'json'
  const contentType = report.format === 'markdown' ? 'text/markdown' : 'application/json'

  res.setHeader('Content-Type', contentType)
  res.setHeader('Content-Disposition', `attachment; filename="report-${id}.${ext}"`)
  res.send(report.content)
})

export default router
