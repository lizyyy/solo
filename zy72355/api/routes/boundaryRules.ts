import { Router, type Request, type Response } from 'express'
import { getAllRules } from '../services/boundaryRuleEngine.js'

const router = Router()

router.get('/', async (_req: Request, res: Response) => {
  try {
    const rules = await getAllRules()
    res.json({ success: true, data: rules })
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
