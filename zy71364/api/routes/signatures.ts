import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../database.js'

const router = Router()

function toCamelCase(row: Record<string, unknown>) {
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(row)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
    result[camel] = row[key]
  }
  return result
}

router.post('/restorations/:id/signatures', (req: Request, res: Response): void => {
  const restoration = db.prepare('SELECT * FROM restorations WHERE id = ?').get(req.params.id)
  if (!restoration) {
    res.status(404).json({ success: false, error: '修复记录不存在' })
    return
  }

  const { signerName, signerRole, signatureData } = req.body
  if (!signerName || !signerRole || !signatureData) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }

  const id = uuidv4()
  const now = new Date().toISOString()

  const insertSignature = db.transaction(() => {
    db.prepare(`
      INSERT INTO signatures (id, restoration_id, signer_name, signer_role, signature_data, signed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, req.params.id, signerName, signerRole, signatureData, now)

    if (signerRole === 'reviewer') {
      db.prepare('UPDATE anomalies SET status = ? WHERE restoration_id = ? AND status = ?').run('confirmed', req.params.id, 'corrected')
    }
  })

  insertSignature()

  const row = db.prepare('SELECT * FROM signatures WHERE id = ?').get(id) as Record<string, unknown>
  res.status(201).json({ success: true, data: toCamelCase(row) })
})

router.get('/restorations/:id/signatures', (req: Request, res: Response): void => {
  const restoration = db.prepare('SELECT id FROM restorations WHERE id = ?').get(req.params.id)
  if (!restoration) {
    res.status(404).json({ success: false, error: '修复记录不存在' })
    return
  }

  const rows = db.prepare('SELECT * FROM signatures WHERE restoration_id = ? ORDER BY signed_at').all(req.params.id) as Record<string, unknown>[]
  res.json({ success: true, data: rows.map(toCamelCase) })
})

router.get('/restorations/:id/trace-chain', (req: Request, res: Response): void => {
  const restoration = db.prepare('SELECT id FROM restorations WHERE id = ?').get(req.params.id)
  if (!restoration) {
    res.status(404).json({ success: false, error: '修复记录不存在' })
    return
  }

  const anomalies = db.prepare('SELECT * FROM anomalies WHERE restoration_id = ? ORDER BY detected_at').all(req.params.id) as Record<string, unknown>[]

  const chain = anomalies.map(anomaly => {
    const corrections = db.prepare('SELECT * FROM corrections WHERE anomaly_id = ? ORDER BY corrected_at').all(anomaly.id) as Record<string, unknown>[]

    const reviewerSignatures = db.prepare(`
      SELECT s.* FROM signatures s
      WHERE s.restoration_id = ? AND s.signer_role = 'reviewer'
      AND s.signed_at >= ?
      ORDER BY s.signed_at LIMIT 1
    `).all(req.params.id, anomaly.detected_at) as Record<string, unknown>[]

    const confirmationSignature = reviewerSignatures.length > 0 ? toCamelCase(reviewerSignatures[0]) : undefined

    return {
      anomaly: toCamelCase(anomaly),
      corrections: corrections.map(toCamelCase),
      confirmationSignature,
    }
  })

  res.json({ success: true, data: chain })
})

export default router
