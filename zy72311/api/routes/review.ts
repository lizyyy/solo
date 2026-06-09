import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/database.js'

const router = Router()

router.get('/', (_req: Request, res: Response): void => {
  const db = getDb()
  const tasks = db.prepare(`
    SELECT rt.id, rt.record_id, rt.reviewer, rt.status, rt.review_note,
           rt.original_statement, rt.corrected_value, rt.next_handler, rt.boundary_note_id,
           rt.created_at, rt.reviewed_at,
           qr.target_name, qr.record_type, qr.raw_value, qr.score, qr.source, qr.status as qr_status,
           qr.boundary_note_id as qr_boundary_note_id, qr.original_statement as qr_original_statement
    FROM review_tasks rt
    JOIN questionnaire_raw qr ON rt.record_id = qr.id
    WHERE rt.status = 'pending'
    ORDER BY rt.created_at DESC
  `).all()

  res.json({ success: true, data: { tasks } })
})

router.put('/:id', (req: Request, res: Response): void => {
  const { id } = req.params
  const { decision, note, operator, originalStatement, correctedValue, nextHandler } = req.body as {
    decision: 'approved' | 'rejected'
    note?: string
    operator: string
    originalStatement?: string
    correctedValue?: string
    nextHandler?: string
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

  const qrRecord = db.prepare('SELECT * FROM questionnaire_raw WHERE id = ?').get(task.record_id) as any

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, operator, action, target_type, target_id, before_value, after_value, reason, affected_results, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE review_tasks
      SET status = ?, review_note = ?, reviewed_at = ?, original_statement = ?, corrected_value = ?, next_handler = ?, boundary_note_id = ?
      WHERE id = ?
    `).run(
      decision,
      note || '',
      now,
      originalStatement || null,
      correctedValue || null,
      nextHandler || null,
      qrRecord?.boundary_note_id || task.boundary_note_id || null,
      id
    )

    const newQrStatus = decision === 'approved' ? 'confirmed' : 'rejected'
    let finalCorrectedScore: number | undefined

    if (decision === 'approved' && correctedValue && correctedValue.trim() !== '') {
      const parsedCorrected = parseFloat(correctedValue)
      if (!isNaN(parsedCorrected)) {
        finalCorrectedScore = parsedCorrected
        db.prepare(`
          UPDATE questionnaire_raw
          SET score = ?, status = ?, boundary_note_id = ?, original_statement = ?
          WHERE id = ?
        `).run(
          parsedCorrected,
          newQrStatus,
          qrRecord?.boundary_note_id || task.boundary_note_id || null,
          originalStatement || qrRecord?.original_statement || null,
          task.record_id
        )
      } else {
        db.prepare(`
          UPDATE questionnaire_raw SET status = ? WHERE id = ?
        `).run(newQrStatus, task.record_id)
      }
    } else {
      db.prepare(`
        UPDATE questionnaire_raw SET status = ? WHERE id = ?
      `).run(newQrStatus, task.record_id)
    }

    let reasonText = note || `复核${decision === 'approved' ? '通过' : '驳回'}`
    if (originalStatement) {
      reasonText += `，原始说法：${originalStatement}`
    }
    if (nextHandler) {
      reasonText += `，下一步：${nextHandler}`
    }

    const beforeValue = JSON.stringify({
      review_status: 'pending',
      score: qrRecord?.score,
      original_statement: originalStatement || qrRecord?.original_statement || null
    })
    const afterValue = JSON.stringify({
      review_status: decision,
      correctedValue: correctedValue || null,
      nextHandler: nextHandler || null,
      qrStatus: newQrStatus,
      finalScore: finalCorrectedScore !== undefined ? finalCorrectedScore : qrRecord?.score
    })

    insertAudit.run(
      uuidv4(), operator, 'review', 'questionnaire', task.record_id,
      beforeValue,
      afterValue,
      reasonText,
      JSON.stringify([task.record_id, id]),
      now
    )
  })

  transaction()

  res.json({ success: true, data: { taskId: id, status: decision } })
})

export default router
