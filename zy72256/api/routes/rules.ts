import { Router, type Request, type Response } from 'express'
import { getDb } from '../database.js'
import type { BoundaryRule, RuleCategory } from '../../shared/types.js'

const router = Router()

router.get('/rules', (_req: Request, res: Response): void => {
  const db = getDb()
  const rules = db.prepare('SELECT * FROM boundary_rules ORDER BY category, rowid').all() as BoundaryRule[]
  res.json({ success: true, data: rules })
})

router.get('/rules/:category', (req: Request, res: Response): void => {
  const db = getDb()
  const category = req.params.category as RuleCategory
  const rules = db.prepare('SELECT * FROM boundary_rules WHERE category = ? ORDER BY rowid').all(category) as BoundaryRule[]
  res.json({ success: true, data: rules })
})

export default router
