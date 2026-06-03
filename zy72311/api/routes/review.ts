import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/database.js'

const router = Router()

router.get('/', (_req: Request, res: Response): void => {
  const db = getDb()
  const tasks = db.prepare(`
    SELECT rt.*, qr.target_name, qr.record_type, qr.raw_value
    FROM review_tasks rt
    JOIN questionnaire_raw qr ON rt.record_id = qr.id
    WHERE rt.status = 'pending'
    ORDER BY rt.created_at DESC
  `).all()

  res.json({ success: true, data: { tasks } })
})

router.put('/:id', (req: Request, res: Response): void => {
  const { id } = req.params
  const { decision, note, operator } = req.body as {
    decision: 'approved' | 'rejected'
    note: string
    operator: string
  }

  if (!decision || !operator) {
    res.status(400).json({ success: false, error: 'decision and operator are required' })
    return
  }

  if (!['approved', 'rejected'].includes(decision)) {
    res.status(400).json({ success: false, error: 'decision must be approved or rejected' })
    return
  }

  const db = getDb()
  const now = new Date().toISOString()

  const task = db.prepare('SELECT * FROM review_tasks WHERE id = ?').get(id) as any
  if (!task) {
    res.status(404).json({ success: false, error: 'Review task not found' })
    return
  }

  if (task.status !== 'pending') {
    res.status(400).json({ success: false, error: 'Review task already processed' })
    return
  }

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, operator, action, target_type, target_id, before_value, after_value, reason, affected_results, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE review_tasks SET status = ?, review_note = ?, reviewed_at = ? WHERE id = ?
    `).run(decision, note || '', now, id)

    const newQrStatus = decision === 'approved' ? 'confirmed' : 'rejected'
    db.prepare(`
      UPDATE questionnaire_raw SET status = ? WHERE id = ?
    `).run(newQrStatus, task.record_id)

    insertAudit.run(
      uuidv4(), operator, 'review', 'questionnaire', task.record_id,
      JSON.stringify({ review_status: 'pending', qr_status: 'review' }),
      JSON.stringify({ review_status: decision, qr_status: newQrStatus }),
      note || `复核${decision === 'approved' ? '通过' : '驳回'}`,
      JSON.stringify([task.record_id]),
      now
    )
  })

  transaction()

  res.json({ success: true, data: { taskId: id, status: decision } })
})

export default router
