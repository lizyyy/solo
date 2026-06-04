import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'

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

  if (currentStep === 'import') {
    if (!state.import_completed) {
      db.prepare('UPDATE workflow_state SET import_completed = 1 WHERE id = ?').run('singleton')
    }
    db.prepare("UPDATE workflow_state SET current_step = 'counterexample_review' WHERE id = ?").run('singleton')
  } else if (currentStep === 'counterexample_review') {
    if (!state.counterexample_review_completed) {
      db.prepare('UPDATE workflow_state SET counterexample_review_completed = 1 WHERE id = ?').run('singleton')
    }
    db.prepare("UPDATE workflow_state SET current_step = 'demo_update' WHERE id = ?").run('singleton')
  } else if (currentStep === 'demo_update') {
    if (!state.demo_update_completed) {
      db.prepare('UPDATE workflow_state SET demo_update_completed = 1 WHERE id = ?').run('singleton')
    }

    const latestVersion = db.prepare('SELECT id, version FROM param_versions ORDER BY version DESC LIMIT 1').get() as { id: string; version: number } | undefined

    if (latestVersion) {
      const paramItems = db.prepare('SELECT * FROM param_items WHERE version_id = ?').all(latestVersion.id) as any[]

      const insertResult = db.prepare(`
        INSERT INTO demo_results (id, param_item_id, param_name, value, param_version, rationale, is_denominator_zero, review_status, display_label) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const transaction = db.transaction(() => {
        db.prepare('DELETE FROM demo_results').run()

        for (const item of paramItems) {
          let displayLabel = item.value
          let reviewStatus = item.review_status || 'normal'

          if (item.is_denominator_zero === 1) {
            reviewStatus = 'pending_review'
            displayLabel = '⚠ 分母为0，值为空字符串（待复核）'
          }

          insertResult.run(
            uuidv4(),
            item.id,
            item.name,
            item.value,
            String(latestVersion.version),
            item.rationale ?? '',
            item.is_denominator_zero ?? 0,
            reviewStatus,
            displayLabel
          )
        }
      })

      transaction()
    }
  }

  const updatedState = db.prepare('SELECT * FROM workflow_state WHERE id = ?').get('singleton')
  res.json({ success: true, data: updatedState })
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

  const reviewId = uuidv4()

  const transaction = db.transaction(() => {
    db.prepare(`
      INSERT INTO denominator_zero_reviews (id, param_item_id, decision, reviewer, reason) VALUES (?, ?, ?, ?, ?)
    `).run(reviewId, paramItemId, decision, reviewer, reason)

    if (decision === 'confirm_corrected') {
      db.prepare("UPDATE param_items SET review_status = 'reviewed' WHERE id = ?").run(paramItemId)
    } else {
      db.prepare("UPDATE param_items SET review_status = 'reviewed' WHERE id = ?").run(paramItemId)
    }
  })

  transaction()

  const review = db.prepare('SELECT * FROM denominator_zero_reviews WHERE id = ?').get(reviewId)
  const updatedItem = db.prepare('SELECT * FROM param_items WHERE id = ?').get(paramItemId)

  res.json({ success: true, data: { review, updatedItem } })
})

export default router
