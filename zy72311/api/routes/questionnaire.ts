import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/database.js'

const router = Router()

interface ImportRow {
  target_name: string
  weight: string
  score: string
  denominator: string
}

router.post('/import', (req: Request, res: Response): void => {
  const { data, batchId } = req.body as { data: ImportRow[]; batchId: string }

  if (!data || !batchId) {
    res.status(400).json({ success: false, error: 'data and batchId are required' })
    return
  }

  const db = getDb()
  const now = new Date().toISOString()

  let normalCount = 0
  let zeroDenominatorCount = 0
  let supplementedCount = 0

  const insertQr = db.prepare(`
    INSERT INTO questionnaire_raw (id, batch_id, target_name, weight, score, denominator, raw_value, record_type, source, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertReview = db.prepare(`
    INSERT INTO review_tasks (id, record_id, reviewer, status, created_at)
    VALUES (?, ?, ?, ?, ?)
  `)

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, operator, action, target_type, target_id, before_value, after_value, reason, affected_results, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const transaction = db.transaction(() => {
    for (const row of data) {
      const id = uuidv4()
      const weight = parseFloat(row.weight) || 0
      const score = parseFloat(row.score) || 0
      const denominator = parseFloat(row.denominator) || 0
      const rawValue = `${row.target_name},${row.weight},${row.score || ''},${row.denominator || ''}`

      let recordType: string
      let status: string

      if (denominator === 0 && (row.score === '' || row.score === undefined || row.score === null)) {
        recordType = 'zero_denominator_empty'
        status = 'review'
        zeroDenominatorCount++
      } else if (row.score !== '' && row.score !== undefined && row.score !== null && denominator > 0) {
        recordType = 'normal'
        status = 'confirmed'
        normalCount++
      } else {
        recordType = 'normal'
        status = 'pending'
        normalCount++
      }

      insertQr.run(id, batchId, row.target_name, weight, score, denominator, rawValue, recordType, 'questionnaire', status, now)

      if (recordType === 'zero_denominator_empty') {
        const reviewId = uuidv4()
        insertReview.run(reviewId, id, '复核员', 'pending', now)
      }

      insertAudit.run(
        uuidv4(), 'system', 'import', 'questionnaire', id,
        null, JSON.stringify({ target_name: row.target_name, weight, score, denominator }),
        `导入问卷数据：${row.target_name}`,
        JSON.stringify([id]),
        now
      )
    }
  })

  transaction()

  res.json({
    success: true,
    data: {
      batchId,
      totalRecords: data.length,
      normalCount,
      zeroDenominatorCount,
      supplementedCount,
    },
  })
})

router.get('/', (req: Request, res: Response): void => {
  const db = getDb()
  const batchId = req.query.batchId as string | undefined

  let records: any[]
  if (batchId) {
    records = db.prepare('SELECT * FROM questionnaire_raw WHERE batch_id = ? ORDER BY created_at DESC').all(batchId)
  } else {
    records = db.prepare('SELECT * FROM questionnaire_raw ORDER BY created_at DESC').all()
  }

  const summary = {
    total: records.length,
    normal: records.filter(r => r.record_type === 'normal').length,
    zeroDenominator: records.filter(r => r.record_type === 'zero_denominator_empty').length,
    supplemented: records.filter(r => r.record_type === 'supplemented').length,
    pendingReview: records.filter(r => r.status === 'review' || r.status === 'pending').length,
  }

  res.json({ success: true, data: { records, summary } })
})

export default router
