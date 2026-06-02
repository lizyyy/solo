import { Router, type Request, type Response } from 'express'
import { getAnomaliesByBatch } from '../repositories/anomaly.repo.js'

const router = Router()

router.get('/:batchId/anomalies', (req: Request, res: Response): void => {
  try {
    const anomalies = getAnomaliesByBatch(req.params.batchId)
    res.json({ success: true, data: anomalies })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
