import { Router, type Request, type Response } from 'express'
import { authMiddleware } from '../middleware/auth'
import { findAll as findAllHistory } from '../repositories/operationHistoryRepository'

const router = Router()

router.get(
  '/',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { recordId, operator, startDate, endDate } = req.query

      const filters = {
        recordId: recordId as string,
        operator: operator as string,
        startDate: startDate as string,
        endDate: endDate as string
      }

      const result = findAllHistory(filters)

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '获取历史记录失败'
      })
    }
  }
)

export default router
