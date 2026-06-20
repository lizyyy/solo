import { Router, type Request, type Response } from 'express'
import {
  listBatches,
  importBatch,
  getBatch,
  getBatchOverview,
  getBatchSamples,
  recalcBatch,
} from '../services/batches.js'

const router = Router()

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const batches = await listBatches()
    res.json(batches)
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
})

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await importBatch(req.body, '知识库编辑小乔')
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
})

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const batch = await getBatch(id)
    if (!batch) {
      res.status(404).json({ error: 'batch not found' })
      return
    }
    const overview = await getBatchOverview(id)
    const samples = await getBatchSamples(id)
    res.json({
      batch,
      overview,
      samples: {
        lowConfidence: samples.lowConfidence,
        normal: samples.normal,
        all: samples.all,
      },
    })
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
})

router.post('/:id/recalc', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const overview = await recalcBatch(id, '知识库编辑小乔')
    res.json(overview)
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
})

export default router
