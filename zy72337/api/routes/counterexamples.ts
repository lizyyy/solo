import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

const router = Router()

router.get('/', (_req: Request, res: Response): void => {
  const counterexamples = db.prepare('SELECT * FROM counterexamples ORDER BY created_at DESC').all()
  res.json({ success: true, data: counterexamples })
})

router.post('/', (req: Request, res: Response): void => {
  const { name, note, noteRaw, expectedValue, actualValue, sourceParamId } = req.body

  if (!name || !expectedValue || !actualValue) {
    res.status(400).json({ success: false, error: 'name, expectedValue, actualValue are required' })
    return
  }

  const id = uuidv4()
  let hasConflict = 0

  const paramItem = sourceParamId
    ? db.prepare('SELECT * FROM param_items WHERE id = ?').get(sourceParamId) as any
    : db.prepare('SELECT * FROM param_items WHERE name = ? ORDER BY id DESC LIMIT 1').get(name) as any

  if (paramItem && actualValue !== paramItem.value) {
    hasConflict = 1
  }

  const insertCounterexample = db.prepare(`
    INSERT INTO counterexamples (id, name, note, note_raw, expected_value, actual_value, source_param_id, has_conflict) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const transaction = db.transaction(() => {
    insertCounterexample.run(id, name, note ?? '', noteRaw ?? note ?? '', expectedValue, actualValue, paramItem?.id ?? null, hasConflict)

    if (hasConflict && paramItem) {
      db.prepare(`
        INSERT INTO conflicts (id, param_item_id, counterexample_id, param_value, counterexample_value, counterexample_note, status) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), paramItem.id, id, paramItem.value, actualValue, note ?? '', 'pending')
    }
  })

  transaction()

  const counterexample = db.prepare('SELECT * FROM counterexamples WHERE id = ?').get(id)
  res.json({ success: true, data: counterexample })
})

export default router
