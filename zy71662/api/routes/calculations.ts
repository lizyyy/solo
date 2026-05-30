import { Router, type Request, type Response } from 'express'
import * as calculationService from '../services/calculation.service.js'

const router = Router()

router.post('/decompose', (req: Request, res: Response) => {
  try {
    const { schemeId } = req.body
    if (!schemeId) {
      res.status(400).json({ success: false, error: 'schemeId is required' })
      return
    }
    const decompositions = calculationService.decompose(schemeId)
    res.json({ success: true, data: decompositions })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.post('/verify', (req: Request, res: Response) => {
  try {
    const { schemeId } = req.body
    if (!schemeId) {
      res.status(400).json({ success: false, error: 'schemeId is required' })
      return
    }
    const verifications = calculationService.verify(schemeId)
    res.json({ success: true, data: verifications })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.post('/detect-risks', (req: Request, res: Response) => {
  try {
    const { schemeId } = req.body
    if (!schemeId) {
      res.status(400).json({ success: false, error: 'schemeId is required' })
      return
    }
    const risks = calculationService.detectRisks(schemeId)
    res.json({ success: true, data: risks })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

export default router
