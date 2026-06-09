import { Router, type Request, type Response } from 'express'
import {
  listRecords,
  getRecord,
  updateConclusion,
  supplementRecord,
  analyzeRecord,
  type ListFilters,
} from '../services/recordService.js'
import { getHistoryByRecordId } from '../services/historyService.js'
import { analyzeFactors } from '../services/analyzer.js'
import type { RejudgeRequest, SupplementRequest, Conclusion } from '@shared/types.js'

const router = Router()

const VALID_CONCLUSIONS: Conclusion[] = ['normal', 'observe', 'abnormal']
const VALID_SUPPLEMENT_TYPES = ['vaccine', 'weight', 'note']

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const filters: ListFilters = {}
    if (req.query.status) {
      const validStatus = ['pending', 'confirmed', 'exception']
      if (!validStatus.includes(req.query.status as string)) {
        res.status(400).json({
          success: false,
          error: `无效的 status 参数，有效值为：${validStatus.join(', ')}`,
        })
        return
      }
      filters.status = req.query.status as ListFilters['status']
    }
    if (req.query.startDate) {
      filters.startDate = req.query.startDate as string
    }
    if (req.query.endDate) {
      filters.endDate = req.query.endDate as string
    }
    if (req.query.petName) {
      filters.petName = req.query.petName as string
    }
    const data = listRecords(filters)
    res.json({ success: true, data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误'
    res.status(500).json({ success: false, error: msg })
  }
})

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const record = getRecord(req.params.id)
    if (!record) {
      res.status(404).json({ success: false, error: '记录不存在' })
      return
    }
    res.json({ success: true, data: record })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误'
    res.status(500).json({ success: false, error: msg })
  }
})

router.put(
  '/:id/conclusion',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const body = req.body as Partial<RejudgeRequest>

      if (!body.conclusion) {
        res.status(400).json({
          success: false,
          error: '缺少必填字段 conclusion',
        })
        return
      }
      if (!VALID_CONCLUSIONS.includes(body.conclusion)) {
        res.status(400).json({
          success: false,
          error: `无效的 conclusion，有效值为：${VALID_CONCLUSIONS.join(', ')}`,
        })
        return
      }
      if (!body.reason || !body.reason.trim()) {
        res.status(400).json({
          success: false,
          error: '改判必须填写原因（reason）',
        })
        return
      }

      const result = await updateConclusion(id, {
        conclusion: body.conclusion,
        reason: body.reason,
        supplementIds: body.supplementIds || [],
        operator: body.operator || 'system',
      })

      if (!result) {
        res.status(404).json({ success: false, error: '记录不存在' })
        return
      }

      res.json({ success: true, data: result })
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      res.status(500).json({ success: false, error: msg })
    }
  },
)

router.post(
  '/:id/supplement',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const body = req.body as Partial<SupplementRequest>

      if (!body.type) {
        res.status(400).json({
          success: false,
          error: '缺少必填字段 type',
        })
        return
      }
      if (!VALID_SUPPLEMENT_TYPES.includes(body.type)) {
        res.status(400).json({
          success: false,
          error: `无效的 type，有效值为：${VALID_SUPPLEMENT_TYPES.join(', ')}`,
        })
        return
      }
      if (body.content === undefined || body.content === null) {
        res.status(400).json({
          success: false,
          error: '缺少必填字段 content',
        })
        return
      }

      const result = await supplementRecord(id, {
        type: body.type,
        content: body.content,
        operator: body.operator || 'system',
      })

      if (!result) {
        res.status(404).json({ success: false, error: '记录不存在' })
        return
      }

      res.json({ success: true, data: result })
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      res.status(500).json({ success: false, error: msg })
    }
  },
)

router.get(
  '/:id/history',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params
      const record = getRecord(id)
      if (!record) {
        res.status(404).json({ success: false, error: '记录不存在' })
        return
      }
      const data = getHistoryByRecordId(id)
      res.json({ success: true, data })
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      res.status(500).json({ success: false, error: msg })
    }
  },
)

router.post(
  '/analyze',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const body = req.body as { id?: string }
      if (body.id) {
        const result = analyzeRecord(body.id)
        if (!result) {
          res.status(404).json({ success: false, error: '记录不存在' })
          return
        }
        res.json({ success: true, data: result })
        return
      }
      const record = req.body
      const result = analyzeFactors(record)
      res.json({ success: true, data: result })
    } catch (err) {
      const msg = err instanceof Error ? err.message : '未知错误'
      res.status(500).json({ success: false, error: msg })
    }
  },
)

export default router
