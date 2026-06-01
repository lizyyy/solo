import { Router, type Request, type Response } from 'express'
import db from '../database.js'

const router = Router({ mergeParams: true })

router.get('/', (req: Request, res: Response) => {
  const { schemeId } = req.params
  const scheme = db.prepare('SELECT * FROM schemes WHERE id = ?').get(schemeId)
  if (!scheme) {
    res.status(404).json({ success: false, error: '方案不存在' })
    return
  }

  const changes = db.prepare(`
    SELECT * FROM parameter_changes WHERE scheme_id = ? ORDER BY changed_at DESC
  `).all(schemeId)
  res.json({ success: true, data: changes })
})

export default router
