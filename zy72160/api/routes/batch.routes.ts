import { Router, type Request, type Response } from 'express'
import { listBatches, getBatchById, createBatch, getBatchSummary } from '../repositories/batch.repo.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const batches = listBatches()
    res.json({ success: true, data: batches })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/', (req: Request, res: Response): void => {
  try {
    const { name } = req.body
    if (!name) {
      res.status(400).json({ success: false, error: '批次名称不能为空' })
      return
    }
    const batch = createBatch(name)
    res.status(201).json({ success: true, data: batch })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const summary = getBatchSummary(req.params.id)
    if (!summary) {
      res.status(404).json({ success: false, error: '批次不存在' })
      return
    }
    res.json({ success: true, data: summary })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
