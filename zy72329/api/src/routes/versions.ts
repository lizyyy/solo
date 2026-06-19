import { Router, type Request, type Response } from 'express'
import { authMiddleware } from '../middleware/auth'
import { getVersions, getVersion, compareVersions } from '../services/versionService'

const router = Router()

router.get(
  '/',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const result = getVersions()

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '获取版本列表失败'
      })
    }
  }
)

router.get(
  '/compare',
  authMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { from, to } = req.query

      if (!from || !to) {
        res.status(400).json({
          success: false,
          message: '请提供 from 和 to 参数'
        })
        return
      }

      const result = compareVersions(from as string, to as string)

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '版本比较失败'
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
      const result = getVersion(id)

      res.json({
        success: true,
        data: result
      })
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : '获取版本详情失败'
      })
    }
  }
)

export default router
