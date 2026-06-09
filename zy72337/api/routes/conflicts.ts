import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { runRecalcAndCheck } from './demo.js'

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

  const paramItem = db.prepare('SELECT * FROM param_items WHERE id = ?').get(conflict.param_item_id) as any
  if (!paramItem) {
    res.status(404).json({ success: false, error: 'Param item not found' })
    return
  }

  const oldValue = paramItem.value
  const newValue = decision === 'confirmed' ? conflict.counterexample_value : oldValue
  const adjudicationNote = decision === 'confirmed'
    ? `${conflict.counterexample_note} | 裁决: 已确认`
    : `${conflict.counterexample_note} | 裁决: 已驳回`
  const nextAction = decision === 'confirmed' ? '' : 'review_counterexample'

  const adjudicationId = uuidv4()
  const auditLogId = uuidv4()

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO adjudications (id, conflict_id, decision, reason, adjudicator) VALUES (?, ?, ?, ?, ?)
    `).run(adjudicationId, id, decision, reason, adjudicator)

    db.prepare('UPDATE conflicts SET status = ? WHERE id = ?').run(decision, id)

    if (decision === 'confirmed') {
      db.prepare(`
        UPDATE param_items 
        SET value = ?, previous_value = ?, adjudication_note = ?, next_action = ?, last_actor = ?
        WHERE id = ?
      `).run(newValue, oldValue, adjudicationNote, nextAction, adjudicator, conflict.param_item_id)
    } else {
      db.prepare(`
        UPDATE param_items 
        SET previous_value = ?, adjudication_note = ?, next_action = ?, last_actor = ?
        WHERE id = ?
      `).run(oldValue, adjudicationNote, nextAction, adjudicator, conflict.param_item_id)
    }

    db.prepare(`
      INSERT INTO audit_logs (
        id, record_type, record_id, param_item_id, counterexample_id,
        action_type, previous_value, new_value, reason, note, actor, next_action, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      auditLogId,
      'conflict',
      id,
      conflict.param_item_id,
      conflict.counterexample_id,
      'conflict_adjudication',
      oldValue,
      newValue,
      reason,
      adjudicationNote,
      adjudicator,
      nextAction,
      JSON.stringify({ decision, conflict_id: id })
    )
  })

  transaction()

  const { demoResults, selfChecks } = runRecalcAndCheck()

  const adjudication = db.prepare('SELECT * FROM adjudications WHERE id = ?').get(adjudicationId)
  const updatedConflict = db.prepare('SELECT * FROM conflicts WHERE id = ?').get(id)
  const updatedParamItem = db.prepare('SELECT * FROM param_items WHERE id = ?').get(conflict.param_item_id)

  res.json({
    success: true,
    data: {
      adjudication,
      updatedConflict,
      paramItem: updatedParamItem,
      demoResults,
      selfChecks
    }
  })
})

export default router
