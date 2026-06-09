import { Router, type Request, type Response } from 'express'
import db from '../db.js'
import { runAllChecks } from './demo.js'

const router = Router()

router.post('/run', (_req: Request, res: Response): void => {
  const checkResults = runAllChecks()
  res.json({ success: true, data: checkResults })
})

router.get('/latest', (_req: Request, res: Response): void => {
  const latestRun = db.prepare('SELECT run_at FROM self_checks ORDER BY run_at DESC LIMIT 1').get() as { run_at: string } | undefined

  if (!latestRun) {
    res.json({ success: true, data: [] })
    return
  }

  const latestChecks = db.prepare('SELECT * FROM self_checks WHERE run_at = ? ORDER BY check_type').all(latestRun.run_at)
  res.json({ success: true, data: latestChecks })
})

export default router
