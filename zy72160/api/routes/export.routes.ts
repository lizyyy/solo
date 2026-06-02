import { Router, type Request, type Response } from 'express'
import path from 'path'
import fs from 'fs'
import { exportToExcel, exportToPdf } from '../services/export.service.js'

const router = Router()

router.post('/:batchId/export', async (req: Request, res: Response): Promise<void> => {
  try {
    const { filters, format } = req.body
    if (!format || !['excel', 'pdf'].includes(format)) {
      res.status(400).json({ success: false, error: '请指定导出格式：excel 或 pdf' })
      return
    }

    const batchId = req.params.batchId

    if (format === 'excel') {
      const outputPath = exportToExcel(batchId, filters)
      const fileName = path.basename(outputPath)
      res.download(outputPath, fileName, (err) => {
        if (!err) {
          fs.unlink(outputPath, () => {})
        }
      })
    } else {
      const outputPath = await exportToPdf(batchId, filters)
      const fileName = path.basename(outputPath)
      res.download(outputPath, fileName, (err) => {
        if (!err) {
          fs.unlink(outputPath, () => {})
        }
      })
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
