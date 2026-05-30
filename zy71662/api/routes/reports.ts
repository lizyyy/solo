import { Router, type Request, type Response } from 'express'
import path from 'path'
import fs from 'fs'
import * as reportService from '../services/report.service.js'
import * as schemeService from '../services/scheme.service.js'

const router = Router()

router.post('/generate/:id', async (req: Request, res: Response) => {
  try {
    const scheme = schemeService.getSchemeById(req.params.id)
    if (!scheme) {
      res.status(404).json({ success: false, error: 'Scheme not found' })
      return
    }
    const filename = await reportService.generateReport(req.params.id)
    res.json({ success: true, data: { filename } })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.get('/download/:filename', (req: Request, res: Response) => {
  try {
    const filepath = reportService.getReportPath(req.params.filename)
    if (!fs.existsSync(filepath)) {
      res.status(404).json({ success: false, error: 'Report not found' })
      return
    }
    res.download(filepath)
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
