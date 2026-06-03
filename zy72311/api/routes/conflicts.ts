import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/database.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const db = getDb()
  const status = req.query.status as string | undefined

  let conflicts: any[]
  if (status) {
    conflicts = db.prepare('SELECT * FROM conflicts WHERE status = ? ORDER BY created_at DESC').all(status)
  } else {
    conflicts = db.prepare('SELECT * FROM conflicts ORDER BY created_at DESC').all()
  }

  res.json({ success: true, data: { conflicts } })
})

router.put('/:id/resolve', (req: Request, res: Response): void => {
  const { id } = req.params
  const { decision, reason, operator } = req.body as {
    decision: 'confirm' | 'reject'
    reason: string
    operator: string
  }

  if (!decision || !reason || !operator) {
    res.status(400).json({ success: false, error: 'decision, reason and operator are required' })
    return
  }

  if (!['confirm', 'reject'].includes(decision)) {
    res.status(400).json({ success: false, error: 'decision must be confirm or reject' })
    return
  }

  const db = getDb()
  const now = new Date().toISOString()

  const conflict = db.prepare('SELECT * FROM conflicts WHERE id = ?').get(id) as any
  if (!conflict) {
    res.status(404).json({ success: false, error: 'Conflict not found' })
    return
  }

  if (conflict.status !== 'pending') {
    res.status(400).json({ success: false, error: 'Conflict already resolved' })
    return
  }

  const newStatus = decision === 'confirm' ? 'confirmed' : 'rejected'

  const qrRecord = db.prepare('SELECT * FROM questionnaire_raw WHERE id = ?').get(conflict.questionnaire_record_id) as any
  const affectedResults: string[] = []

  const scoringResult = db.prepare("SELECT * FROM scoring_results WHERE target_name = ?").get(qrRecord?.target_name) as any
  if (scoringResult) {
    affectedResults.push(scoringResult.id)
  }

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, operator, action, target_type, target_id, before_value, after_value, reason, affected_results, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE conflicts SET status = ?, resolved_by = ?, resolved_at = ?, resolution = ? WHERE id = ?
    `).run(newStatus, operator, now, decision === 'confirm' ? '采用边界值说明' : '保留问卷原始值', id)

    if (decision === 'confirm' && qrRecord) {
      const newValue = parseFloat(conflict.boundary_note_value)
      db.prepare(`
        UPDATE questionnaire_raw SET score = ?, source = 'boundary_note', status = 'confirmed' WHERE id = ?
      `).run(isNaN(newValue) ? 0 : newValue, conflict.questionnaire_record_id)

      if (scoringResult) {
        const newScore = isNaN(newValue) ? 0 : newValue
        const newWeightedScore = newScore * scoringResult.weight
        db.prepare(`
          UPDATE scoring_results SET score = ?, weighted_score = ?, source = 'boundary_note', version = version + 1, updated_at = ? WHERE id = ?
        `).run(newScore, newWeightedScore, now, scoringResult.id)
      }
    } else if (decision === 'reject' && qrRecord) {
      db.prepare(`
        UPDATE questionnaire_raw SET status = 'confirmed' WHERE id = ?
      `).run(conflict.questionnaire_record_id)
    }

    insertAudit.run(
      uuidv4(), operator, 'resolve_conflict', 'conflict', id,
      JSON.stringify({ status: 'pending', value: conflict.questionnaire_value }),
      JSON.stringify({ status: newStatus, value: decision === 'confirm' ? conflict.boundary_note_value : conflict.questionnaire_value }),
      reason,
      JSON.stringify(affectedResults),
      now
    )
  })

  transaction()

  res.json({
    success: true,
    data: {
      conflictId: id,
      status: newStatus,
      affectedResults,
      auditLogId: 'generated',
    },
  })
})

export default router
