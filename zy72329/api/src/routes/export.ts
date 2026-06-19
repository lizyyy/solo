import { Router, type Request, type Response } from 'express'
import { authMiddleware } from '../middleware/auth'
import { exportToExcel, exportToCSV, getExportData } from '../services/exportService'

const router = Router()

router.get(
  '/excel',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const buffer = exportToExcel()
      const fileName = `稀疏矩阵账单压缩_对账报告_${new Date().toISOString().slice(0, 10)}.xlsx`

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`)
      res.send(buffer)
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '导出失败'
      })
    }
  }
)

router.get(
  '/csv',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const csv = exportToCSV()
      const fileName = `稀疏矩阵账单压缩_对账报告_${new Date().toISOString().slice(0, 10)}.csv`

      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`)
      res.send('\uFEFF' + csv)
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '导出失败'
      })
    }
  }
)

router.get(
  '/preview',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const data = getExportData()
      res.json({
        success: true,
        data: {
          total: data.length,
          records: data.slice(0, 20),
        },
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '获取导出预览失败'
      })
    }
  }
)

export default router
