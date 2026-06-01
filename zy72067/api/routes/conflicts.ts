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

  const conflicts = db.prepare(`
    SELECT sc.* FROM source_conflicts sc
    INNER JOIN hot_spot_records hsr ON sc.record_id = hsr.id
    WHERE hsr.scheme_id = ?
    ORDER BY sc.severity DESC, sc.resolved_at ASC
  `).all(schemeId) as any[]

  const enriched = conflicts.map(c => {
    const sourceA = db.prepare('SELECT * FROM source_attachments WHERE id = ?').get(c.source_a_id)
    const sourceB = db.prepare('SELECT * FROM source_attachments WHERE id = ?').get(c.source_b_id)
    return { ...c, source_a: sourceA, source_b: sourceB }
  })

  res.json({ success: true, data: enriched })
})

router.put('/:id', (req: Request, res: Response) => {
  const conflict = db.prepare('SELECT * FROM source_conflicts WHERE id = ?').get(req.params.id)
  if (!conflict) {
    res.status(404).json({ success: false, error: '冲突不存在' })
    return
  }

  const { resolution, resolved_by } = req.body
  if (!resolution || !resolved_by) {
    res.status(400).json({ success: false, error: '必须提供决策说明和处理人' })
    return
  }

  db.prepare(`
    UPDATE source_conflicts SET resolution = ?, resolved_by = ?, resolved_at = datetime('now')
    WHERE id = ?
  `).run(resolution, resolved_by, req.params.id)

  const updated = db.prepare('SELECT * FROM source_conflicts WHERE id = ?').get(req.params.id)
  res.json({ success: true, data: updated })
})

export default router
