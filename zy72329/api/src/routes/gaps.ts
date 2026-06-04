import { Router, type Request, type Response } from 'express'
import { authMiddleware, requireRole } from '../middleware/auth'
import { getGaps, reviewGap } from '../services/gapService'
import type { UserRole, GapReviewStatus } from '../../../shared/types'

const router = Router()

router.get(
  '/',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = getGaps()

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '获取断档列表失败'
      })
    }
  }
)

router.post(
  '/:id/review',
  authMiddleware,
  requireRole('reviewer' as UserRole),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const { status, note } = req.body

      if (!status) {
        res.status(400).json({
          success: false,
          message: '请提供复核状态'
        })
        return
      }

      const operator = req.user!.username
      const result = reviewGap(id, status as GapReviewStatus, note || '', operator)

      res.json({
        success: true,
        data: result,
        message: '断档复核成功'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '断档复核失败'
      })
    }
  }
)

export default router
