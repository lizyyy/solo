import { Router, type Request, type Response } from 'express'
import { importPhotos, listAssessments, getAssessment, updateRemark, reviewAssessment, getHistoryForItem } from '../services/assessmentService.js'
import { getAllRules } from '../services/boundaryRuleEngine.js'

const router = Router()

router.post('/import', async (req: Request, res: Response) => {
  try {
    const { photos, operator } = req.body
    if (!photos || !Array.isArray(photos)) {
      res.status(400).json({ success: false, error: '缺少 photos 数组' })
      return
    }
    const result = await importPhotos(photos, operator || '质检员小白')
    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined
    const items = await listAssessments(status)
    res.json({ success: true, data: items })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const item = await getAssessment(req.params.id)
    if (!item) {
      res.status(404).json({ success: false, error: '核算条目不存在' })
      return
    }
    res.json({ success: true, data: item })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.patch('/:id/remark', async (req: Request, res: Response) => {
  try {
    const { remark, directionOverride, operator } = req.body
    if (remark === undefined) {
      res.status(400).json({ success: false, error: '缺少 remark 字段' })
      return
    }
    const result = await updateRemark(req.params.id, remark, directionOverride, operator || '质检员小白')
    res.json({ success: true, data: result })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/:id/review', async (req: Request, res: Response) => {
  try {
    const { action, reason, operator } = req.body
    if (!action || !reason) {
      res.status(400).json({ success: false, error: '缺少 action 或 reason 字段' })
      return
    }
    const item = await reviewAssessment(req.params.id, action, reason, operator || '实验老师')
    res.json({ success: true, data: item })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const records = await getHistoryForItem(req.params.id)
    res.json({ success: true, data: records })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
