import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/database.js'

const router = Router()

router.get('/results', (_req: Request, res: Response): void => {
  const db = getDb()

  const results = db.prepare('SELECT * FROM scoring_results ORDER BY target_name').all()

  const totalWeight = (results as any[]).reduce((sum, r) => sum + r.weight, 0)
  const totalScore = (results as any[]).reduce((sum, r) => sum + r.weighted_score, 0)

  const pendingConflicts = (db.prepare("SELECT COUNT(*) as cnt FROM conflicts WHERE status = 'pending'").get() as any).cnt
  const pendingReviews = (db.prepare("SELECT COUNT(*) as cnt FROM review_tasks WHERE status = 'pending'").get() as any).cnt

  let stepStatus: 'imported' | 'reviewed' | 'updated' = 'imported'
  if (pendingConflicts === 0 && pendingReviews === 0) {
    stepStatus = 'updated'
  } else if (pendingConflicts === 0) {
    stepStatus = 'reviewed'
  }

  res.json({
    success: true,
    data: {
      results,
      stepStatus,
      totalWeight,
      totalScore,
    },
  })
})

router.post('/update', (req: Request, res: Response): void => {
  const { batchId } = req.body as { batchId?: string }

  const db = getDb()
  const now = new Date().toISOString()

  const previousResults = db.prepare('SELECT * FROM scoring_results ORDER BY target_name').all() as any[]

  let questionnaireRecords: any[]
  if (batchId) {
    questionnaireRecords = db.prepare(
      "SELECT * FROM questionnaire_raw WHERE batch_id = ? AND status IN ('confirmed', 'pending') ORDER BY target_name"
    ).all(batchId) as any[]
  } else {
    questionnaireRecords = db.prepare(
      "SELECT * FROM questionnaire_raw WHERE status IN ('confirmed') ORDER BY target_name"
    ).all() as any[]
  }

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, operator, action, target_type, target_id, before_value, after_value, reason, affected_results, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const auditLogIds: string[] = []

  const transaction = db.transaction(() => {
    for (const sr of previousResults) {
      const latestQr = db.prepare(
        "SELECT * FROM questionnaire_raw WHERE target_name = ? AND status = 'confirmed' ORDER BY created_at DESC LIMIT 1"
      ).get(sr.target_name) as any

      if (!latestQr) continue

      const newScore = latestQr.score ?? 0
      const newWeightedScore = newScore * sr.weight
      const newSource = latestQr.source

      if (newScore === sr.score && newSource === sr.source) continue

      const beforeValue = JSON.stringify({
        score: sr.score,
        weighted_score: sr.weighted_score,
        version: sr.version,
        source: sr.source
      })
      const afterValue = JSON.stringify({
        score: newScore,
        weighted_score: newWeightedScore,
        version: sr.version + 1,
        source: newSource,
        questionnaireRecordId: latestQr.id
      })

      db.prepare(`
        UPDATE scoring_results
        SET score = ?, weighted_score = ?, source = ?, version = version + 1, updated_at = ?
        WHERE id = ?
      `).run(newScore, newWeightedScore, newSource, now, sr.id)

      const auditId = uuidv4()
      auditLogIds.push(auditId)

      insertAudit.run(
        auditId, 'system', 'update_result', 'scoring_result', sr.id,
        beforeValue, afterValue,
        `根据问卷记录(ID: ${latestQr.id}, 状态: ${latestQr.status})更新评分结果：${sr.target_name}`,
        JSON.stringify([sr.id]),
        now
      )
    }
  })

  transaction()

  const updatedResults = db.prepare('SELECT * FROM scoring_results ORDER BY target_name').all()

  res.json({
    success: true,
    data: {
      updatedResults,
      previousResults,
      auditLogIds,
    },
  })
})

export default router
