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
  if (pendingConflicts > 0 || pendingReviews > 0) {
    stepStatus = 'imported'
  } else {
    const lastUpdateAudit = db.prepare(
      "SELECT created_at FROM audit_logs WHERE action = 'update_result' ORDER BY created_at DESC LIMIT 1"
    ).get() as { created_at: string } | undefined

    const lastProcessingAudit = db.prepare(
      "SELECT created_at FROM audit_logs WHERE action IN ('supplement', 'resolve_conflict', 'review') ORDER BY created_at DESC LIMIT 1"
    ).get() as { created_at: string } | undefined

    if (lastUpdateAudit && (!lastProcessingAudit || lastUpdateAudit.created_at >= lastProcessingAudit.created_at)) {
      stepStatus = 'updated'
    } else {
      stepStatus = 'reviewed'
    }
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

  let allConfirmed: any[]
  if (batchId) {
    allConfirmed = db.prepare(
      "SELECT * FROM questionnaire_raw WHERE batch_id = ? AND status = 'confirmed' ORDER BY created_at DESC"
    ).all(batchId) as any[]
  } else {
    allConfirmed = db.prepare(
      "SELECT * FROM questionnaire_raw WHERE status = 'confirmed' ORDER BY created_at DESC"
    ).all() as any[]
  }

  const latestByTarget = new Map<string, any>()
  for (const r of allConfirmed) {
    if (!latestByTarget.has(r.target_name)) {
      latestByTarget.set(r.target_name, r)
    }
  }

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, operator, action, target_type, target_id, before_value, after_value, reason, affected_results, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertSr = db.prepare(`
    INSERT INTO scoring_results (id, target_name, weight, score, weighted_score, source, version, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const auditLogIds: string[] = []

  const transaction = db.transaction(() => {
    for (const [targetName, qr] of latestByTarget) {
      const newScore = qr.score ?? 0
      const newWeight = qr.weight ?? 0
      const newWeightedScore = newScore * newWeight
      const newSource = qr.source
      const existingSr = db.prepare("SELECT * FROM scoring_results WHERE target_name = ?").get(targetName) as any

      if (existingSr) {
        if (newScore === existingSr.score && newSource === existingSr.source && newWeight === existingSr.weight) continue

        const beforeValue = JSON.stringify({
          score: existingSr.score,
          weighted_score: existingSr.weighted_score,
          version: existingSr.version,
          source: existingSr.source,
          weight: existingSr.weight
        })
        const afterValue = JSON.stringify({
          score: newScore,
          weighted_score: newWeightedScore,
          version: existingSr.version + 1,
          source: newSource,
          weight: newWeight,
          questionnaireRecordId: qr.id,
          batchId: qr.batch_id
        })

        db.prepare(`
          UPDATE scoring_results
          SET score = ?, weighted_score = ?, source = ?, weight = ?, version = version + 1, updated_at = ?
          WHERE id = ?
        `).run(newScore, newWeightedScore, newSource, newWeight, now, existingSr.id)

        const auditId = uuidv4()
        auditLogIds.push(auditId)

        insertAudit.run(
          auditId, 'system', 'update_result', 'scoring_result', existingSr.id,
          beforeValue, afterValue,
          `根据问卷记录(ID: ${qr.id}, 批次: ${qr.batch_id})更新评分结果：${targetName}`,
          JSON.stringify([existingSr.id]),
          now
        )
      } else {
        const srId = uuidv4()
        insertSr.run(srId, targetName, newWeight, newScore, newWeightedScore, newSource, 1, now)

        const auditId = uuidv4()
        auditLogIds.push(auditId)

        insertAudit.run(
          auditId, 'system', 'update_result', 'scoring_result', srId,
          null,
          JSON.stringify({ score: newScore, weighted_score: newWeightedScore, source: newSource, weight: newWeight, questionnaireRecordId: qr.id, batchId: qr.batch_id }),
          `根据问卷记录(ID: ${qr.id}, 批次: ${qr.batch_id})新建评分结果：${targetName}`,
          JSON.stringify([srId]),
          now
        )
      }
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
