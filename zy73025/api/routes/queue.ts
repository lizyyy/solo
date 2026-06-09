import { Router, type Request, type Response } from 'express'
import { listQueue, ackException, getQueueItem } from '../services/queueService.js'
import type { ExceptionType } from '@shared/types.js'

const router = Router()

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const type = req.query.type as ExceptionType | undefined
    const validTypes: ExceptionType[] = [
      'vaccine_missing',
      'boundary_sample',
      'legacy_curve',
      'pending_reason',
    ]
    if (type && !validTypes.includes(type)) {
      res.status(400).json({
        success: false,
        error: `无效的 type 参数，有效值为：${validTypes.join(', ')}`,
      })
      return
    }
    const data = listQueue(type)
    res.json({ success: true, data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误'
    res.status(500).json({ success: false, error: msg })
  }
})

router.post(
  '/:id/ack',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const { note, operator } = req.body as {
        note?: string
        operator?: string
      }
      if (!note || !note.trim()) {
        res.status(400).json({
          success: false,
          error: '确认异常必须填写备注说明（note）',
        })
        return
      }
      const existing = getQueueItem(id)
      if (!existing) {
        res.status(404).json({
          success: false,
          error: '异常队列项不存在',
        })
        return
      }
      const result = await ackException(id, note.trim(), operator || 'system')
      res.json({ success: true, data: result })
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      res.status(500).json({ success: false, error: msg })
    }
  },
)

export default router
