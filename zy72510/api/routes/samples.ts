import { Router, type Request, type Response } from 'express'
import {
  getSample,
  reviewSample,
  supplementSamples,
} from '../services/samples.js'

const router = Router()

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const sample = await getSample(id)
    if (!sample) {
      res.status(404).json({ error: 'sample not found' })
      return
    }
    res.json(sample)
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
})

router.put('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const sample = await reviewSample(id, req.body)
    res.json(sample)
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
})

router.post('/supplement', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await supplementSamples(req.body, '知识库编辑小乔')
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
})


router.get('/:id/history', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const sample = await getSample(id)
    if (!sample) {
      res.status(404).json({ error: 'sample not found' })
      return
    }
    res.json(sample.history || [])
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
})

export default router
