import { Router, type Request, type Response } from 'express'
import { authMiddleware, requireRole } from '../middleware/auth'
import { getConflicts, resolveConflict } from '../services/conflictService'
import type { UserRole, ConflictResolution } from '../../../shared/types'

const router = Router()

router.get(
  '/',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = getConflicts()

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '获取冲突列表失败'
      })
    }
  }
)

router.post(
  '/:id/resolve',
  authMiddleware,
  requireRole('coach' as UserRole),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const { resolution, note } = req.body

      if (!resolution) {
        res.status(400).json({
          success: false,
          message: '请提供处理方式'
        })
        return
      }

      const operator = req.user!.username
      const result = resolveConflict(id, resolution as ConflictResolution, note || '', operator)

      res.json({
        success: true,
        data: result,
        message: '冲突处理成功'
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '冲突处理失败'
      })
    }
  }
)

export default router
