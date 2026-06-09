import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { runRecalcAndCheck } from './demo.js'

const router = Router()

router.get('/state', (_req: Request, res: Response): void => {
  const state = db.prepare('SELECT * FROM workflow_state WHERE id = ?').get('singleton') as any

  if (!state) {
    res.status(404).json({ success: false, error: 'Workflow state not found' })
    return
  }

  const pendingConflicts = db.prepare("SELECT COUNT(*) as cnt FROM conflicts WHERE status = 'pending'").get() as { cnt: number }
  const pendingReviews = db.prepare("SELECT COUNT(*) as cnt FROM param_items WHERE is_denominator_zero = 1 AND review_status = 'pending_review'").get() as { cnt: number }

  res.json({
    success: true,
    data: {
      ...state,
      pendingConflicts: pendingConflicts.cnt,
      pendingReviews: pendingReviews.cnt
    }
  })
})

router.post('/advance', (req: Request, res: Response): void => {
  const state = db.prepare('SELECT * FROM workflow_state WHERE id = ?').get('singleton') as any

  if (!state) {
    res.status(404).json({ success: false, error: 'Workflow state not found' })
    return
  }

  const currentStep = state.current_step
  const auditLogId = uuidv4()
  let nextStep = currentStep
  let demoResult: { demoResults: any[]; selfChecks: any[] } | null = null

  const transaction = db.transaction(() => {
    if (currentStep === 'import') {
      if (!state.import_completed) {
        db.prepare('UPDATE workflow_state SET import_completed = 1 WHERE id = ?').run('singleton')
      }
      nextStep = 'counterexample_review'
      db.prepare("UPDATE workflow_state SET current_step = ? WHERE id = ?").run(nextStep, 'singleton')
    } else if (currentStep === 'counterexample_review') {
      if (!state.counterexample_review_completed) {
        db.prepare('UPDATE workflow_state SET counterexample_review_completed = 1 WHERE id = ?').run('singleton')
      }
      nextStep = 'demo_update'
      db.prepare("UPDATE workflow_state SET current_step = ? WHERE id = ?").run(nextStep, 'singleton')
    } else if (currentStep === 'demo_update') {
      if (!state.demo_update_completed) {
        db.prepare('UPDATE workflow_state SET demo_update_completed = 1 WHERE id = ?').run('singleton')
      }
      nextStep = 'demo_update'
    }

    db.prepare(`
      INSERT INTO audit_logs (
        id, record_type, record_id, action_type, previous_value, new_value,
        reason, note, actor, next_action, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      auditLogId,
      'workflow_step',
      'singleton',
      'workflow_advance',
      currentStep,
      nextStep,
      '',
      '',
      (req.body && req.body.actor) || '',
      nextStep,
      JSON.stringify({ from: currentStep, to: nextStep })
    )
  })

  transaction()

  if (currentStep === 'demo_update') {
    demoResult = runRecalcAndCheck()
  }

  const updatedState = db.prepare('SELECT * FROM workflow_state WHERE id = ?').get('singleton')

  if (demoResult) {
    res.json({
      success: true,
      data: {
        state: updatedState,
        demoResults: demoResult.demoResults,
        selfChecks: demoResult.selfChecks
      }
    })
  } else {
    res.json({ success: true, data: updatedState })
  }
})

router.post('/review-denominator-zero', (req: Request, res: Response): void => {
  const { paramItemId, decision, reviewer = '', reason = '' } = req.body

  if (!paramItemId || !decision || !['confirm_anomaly', 'confirm_corrected'].includes(decision)) {
    res.status(400).json({ success: false, error: 'paramItemId and decision (confirm_anomaly|confirm_corrected) are required' })
    return
  }

  const paramItem = db.prepare('SELECT * FROM param_items WHERE id = ?').get(paramItemId) as any
  if (!paramItem) {
    res.status(404).json({ success: false, error: 'Param item not found' })
    return
  }

  const oldValue = paramItem.value
  const newValue = ''
  const reviewNoteFull = [reason, paramItem.review_note].filter(Boolean).join(' | ')
  const reviewAction = decision === 'confirm_corrected' ? 'confirm_corrected' : 'confirm_anomaly'
  const nextAction = ''

  const reviewId = uuidv4()
  const auditLogId = uuidv4()

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO denominator_zero_reviews (id, param_item_id, decision, reviewer, reason) VALUES (?, ?, ?, ?, ?)
    `).run(reviewId, paramItemId, decision, reviewer, reason)

    db.prepare(`
      UPDATE param_items 
      SET review_status = 'reviewed',
          review_note = ?,
          previous_value = ?,
          next_action = ?,
          last_actor = ?
      WHERE id = ?
    `).run(reviewNoteFull, oldValue, nextAction, reviewer, paramItemId)

    db.prepare(`
      INSERT INTO audit_logs (
        id, record_type, record_id, param_item_id, action_type,
        previous_value, new_value, reason, note, actor, next_action, details
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      auditLogId,
      'denominator_zero_review',
      reviewId,
      paramItemId,
      'denominator_zero_review',
      oldValue,
      newValue,
      reason,
      reviewNoteFull,
      reviewer,
      nextAction,
      JSON.stringify({ decision, review_action: reviewAction })
    )
  })

  transaction()

  const { demoResults, selfChecks } = runRecalcAndCheck()

  const review = db.prepare('SELECT * FROM denominator_zero_reviews WHERE id = ?').get(reviewId)
  const updatedItem = db.prepare('SELECT * FROM param_items WHERE id = ?').get(paramItemId)

  res.json({
    success: true,
    data: {
      review,
      updatedItem,
      demoResults,
      selfChecks
    }
  })
})

export default router
