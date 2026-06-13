import { Router, type Request, type Response } from 'express'
import { runSelfCheck } from '../services/selfcheck.js'

const router = Router()

router.get('/:batchId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { batchId } = req.params
    const report = await runSelfCheck(batchId)
    res.json(report)
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
})

export default router
