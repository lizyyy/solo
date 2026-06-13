import { Router, type Request, type Response } from 'express'
import { getSample } from '../services/samples.js'

const router = Router()

router.get('/:sampleId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sampleId } = req.params
    const sample = await getSample(sampleId)
    if (!sample) {
      res.status(404).json({ error: 'sample not found' })
      return
    }
    res.json(sample.history)
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
})

export default router
