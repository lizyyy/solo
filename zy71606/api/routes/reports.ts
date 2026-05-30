import { Router, type Request, type Response } from 'express'
import {
  generateReport,
  getReportHistory,
  getReportSnapshot,
  exportReport,
} from '../services/reportService.js'

const router = Router()

router.post('/generate', (req: Request, res: Response): void => {
  const filters = req.body || {}
  const result = generateReport(filters)
  res.status(201).json({ success: true, data: result })
})

router.get('/histories', (req: Request, res: Response): void => {
  const result = getReportHistory()
  res.json({ success: true, data: result })
})

router.get('/:id', (req: Request, res: Response): void => {
  const { id } = req.params
  const result = getReportSnapshot(id)
  res.json({ success: true, data: result })
})

router.get('/:id/export', (req: Request, res: Response): void => {
  const { id } = req.params
  const format = (req.query.format as string) || 'xlsx'

  if (format !== 'xlsx' && format !== 'csv') {
    res.status(400).json({ success: false, error: '格式仅支持 xlsx 或 csv' })
    return
  }

  const buffer = exportReport(id, format as 'xlsx' | 'csv')

  const mimeType = format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  const fileName = `report_${id}.${format}`

  res.setHeader('Content-Type', `${mimeType}; charset=utf-8`)
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`)
  res.send(buffer)
})

export default router
