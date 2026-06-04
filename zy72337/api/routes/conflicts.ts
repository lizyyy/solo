import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { status } = req.query

  let conflicts: any[]
  if (status) {
    conflicts = db.prepare('SELECT * FROM conflicts WHERE status = ? ORDER BY detected_at DESC').all(status)
  } else {
    conflicts = db.prepare('SELECT * FROM conflicts ORDER BY detected_at DESC').all()
  }

  res.json({ success: true, data: conflicts })
})

router.post('/:id/adjudicate', (req: Request, res: Response): void => {
  const { id } = req.params
  const { decision, reason = '', adjudicator = '' } = req.body

  if (!decision || !['confirmed', 'rejected'].includes(decision)) {
    res.status(400).json({ success: false, error: 'decision must be confirmed or rejected' })
    return
  }

  const conflict = db.prepare('SELECT * FROM conflicts WHERE id = ?').get(id) as any
  if (!conflict) {
    res.status(404).json({ success: false, error: 'Conflict not found' })
    return
  }

  const adjudicationId = uuidv4()

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO adjudications (id, conflict_id, decision, reason, adjudicator) VALUES (?, ?, ?, ?, ?)
    `).run(adjudicationId, id, decision, reason, adjudicator)

    db.prepare('UPDATE conflicts SET status = ? WHERE id = ?').run(decision, id)

    if (decision === 'confirmed') {
      db.prepare('UPDATE param_items SET value = ? WHERE id = ?').run(conflict.counterexample_value, conflict.param_item_id)
    }
  })

  transaction()

  const adjudication = db.prepare('SELECT * FROM adjudications WHERE id = ?').get(adjudicationId)
  const updatedConflict = db.prepare('SELECT * FROM conflicts WHERE id = ?').get(id)

  res.json({ success: true, data: { adjudication, updatedConflict } })
})

export default router
