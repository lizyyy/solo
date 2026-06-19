import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { runRecalcAndCheck } from './demo.js'

const router = Router()

router.get('/', (_req: Request, res: Response): void => {
  const counterexamples = db.prepare('SELECT * FROM counterexamples ORDER BY created_at DESC').all()
  res.json({ success: true, data: counterexamples })
})

router.post('/', (req: Request, res: Response): void => {
  const {
    name,
    note = '',
    noteRaw,
    expectedValue,
    actualValue,
    sourceParamId,
    nextAction = '',
    actor = '',
    reason = '',
  } = req.body

  if (!name || !expectedValue || !actualValue) {
    res.status(400).json({ success: false, error: 'name, expectedValue, actualValue are required' })
    return
  }

  const id = uuidv4()
  let hasConflict = 0

  const paramItem = sourceParamId
    ? db.prepare('SELECT * FROM param_items WHERE id = ?').get(sourceParamId) as any
    : db.prepare('SELECT * FROM param_items WHERE name = ? ORDER BY id DESC LIMIT 1').get(name) as any

  if (paramItem && expectedValue !== paramItem.value) {
    hasConflict = 1
  }

  const rawNote = noteRaw ?? note ?? ''
  const previousValue = paramItem?.value ?? ''
  const fullNote = reason && note ? `${reason} | ${note}` : (reason || note)

  const insertCounterexample = db.prepare(`
    INSERT INTO counterexamples (
      id, name, note, note_raw, expected_value, actual_value,
      source_param_id, has_conflict, previous_value, adjudication_note,
      review_note, next_action, last_actor
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const auditId = uuidv4()
  const counterexampleNoteForConflict = rawNote || fullNote || ''

  const transaction = db.transaction(() => {
    insertCounterexample.run(
      id,
      name,
      fullNote,
      rawNote,
      expectedValue,
      actualValue,
      paramItem?.id ?? null,
      hasConflict,
      previousValue,
      '',
      '',
      nextAction,
      actor,
    )

    if (hasConflict && paramItem) {
      db.prepare(`
        INSERT INTO conflicts (id, param_item_id, counterexample_id, param_value, counterexample_value, counterexample_note, status) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        paramItem.id,
        id,
        paramItem.value,
        expectedValue,
        counterexampleNoteForConflict,
        'pending',
      )
    }

    db.prepare(`
      INSERT INTO audit_logs (
        id, record_type, record_id, param_item_id, counterexample_id, action_type,
        previous_value, new_value, reason, note, actor, next_action, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      auditId,
      'counterexample',
      id,
      paramItem?.id ?? null,
      id,
      'counterexample_create',
      previousValue,
      actualValue,
      reason,
      fullNote,
      actor,
      nextAction,
      JSON.stringify({
        name,
        expected_value: expectedValue,
        source_param_id: paramItem?.id ?? null,
        has_conflict: hasConflict,
      }),
    )
  })

  transaction()

  const { demoResults, selfChecks } = runRecalcAndCheck()

  const counterexample = db.prepare('SELECT * FROM counterexamples WHERE id = ?').get(id)
  const newConflict = hasConflict
    ? db.prepare('SELECT * FROM conflicts WHERE counterexample_id = ? ORDER BY detected_at DESC LIMIT 1').get(id)
    : null

  res.json({
    success: true,
    data: {
      counterexample,
      conflict: newConflict,
      demoResults,
      selfChecks,
    },
  })
})

export default router
