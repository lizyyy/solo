import { Router, type Request, type Response } from 'express'
import { authMiddleware } from '../middleware/auth'
import { getRecords, getRecordDetail, getEvidenceChain } from '../services/recordService'

const router = Router()

router.get(
  '/',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { status } = req.query
      const result = getRecords(status as string)

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '获取记录列表失败'
      })
    }
  }
)

router.get(
  '/:id',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const result = getRecordDetail(id)

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '获取记录详情失败'
      })
    }
  }
)

router.get(
  '/:id/evidence',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const result = getEvidenceChain(id)

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '获取证据链失败'
      })
    }
  }
)

export default router
