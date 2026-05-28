import { Router, type Request, type Response } from 'express'
import inventoryService from '../services/inventoryService.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  try {
    const data = inventoryService.getAllInventory()
    res.json({ success: true, data })
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server internal error' })
  }
})

export default router
