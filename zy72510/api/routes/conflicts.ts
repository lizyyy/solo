import { Router, type Request, type Response } from 'express'
import {
  listConflicts,
  resolveConflict,
} from '../services/conflicts.js'

const router = Router()

router.get('/:batchId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { batchId } = req.params
    const conflicts = await listConflicts(batchId)
    res.json(conflicts)
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
})

router.post('/:id/resolve', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const conflict = await resolveConflict(id, req.body)
    res.json(conflict)
  } catch (error) {
    res.status(500).json({ error: (error as Error).message })
  }
})

export default router
