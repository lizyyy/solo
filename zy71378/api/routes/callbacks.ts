import { Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { verifySignature } from '../services/signatureVerifier.js'
import { checkIdempotency } from '../services/idempotencyChecker.js'
import { detectStatusRegression } from '../services/statusTracker.js'
import { buildFilterClause } from '../filterHelper.js'

const router = Router()

router.get('/', (req, res) => {
  try {
    const { where, params } = buildFilterClause(req.query)
    const page = Math.max(1, parseInt(req.query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20))
    const offset = (page - 1) * limit
    const sortBy = (req.query.sort_by as string) || 'timestamp'
    const sortOrder = (req.query.sort_order as string) === 'asc' ? 'ASC' : 'DESC'

    const allowedSortColumns = ['timestamp', 'retry_count', 'order_status', 'signature_status', 'processing_result', 'confirm_status']
    const safeSortBy = allowedSortColumns.includes(sortBy) ? sortBy : 'timestamp'

    const whereClause = where ? ` WHERE ${where}` : ''
    const total = ((db.prepare(`SELECT COUNT(*) as count FROM callback_records${whereClause}`).get(...params) as any).count) || 0

    const callbacks = db.prepare(
      `SELECT * FROM callback_records${whereClause} ORDER BY ${safeSortBy} ${sortOrder} LIMIT ? OFFSET ?`
    ).all(...params, limit, offset)

    res.json({ data: callbacks, total, page, limit })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch callbacks' })
  }
})

router.post('/import', (req, res) => {
  try {
    const records = req.body.records || req.body
    if (!Array.isArray(records)) {
      res.status(400).json({ success: false, error: 'Expected an array of records' })
      return
    }

    const insertStmt = db.prepare(`
      INSERT INTO callback_records (id, webhook_id, timestamp, signature_header, signature_status, retry_count, order_id, order_status, previous_status, processing_result, confirm_status, raw_payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    let imported = 0
    let duplicates = 0
    let regressions = 0
    let expired = 0
    let errors = 0

    const insertTransaction = db.transaction((items: any[]) => {
      for (const item of items) {
        try {
          const id = item.id || uuidv4()
          const webhookId = item.webhook_id || `wh_${Date.now()}`
          const timestamp = item.timestamp || new Date().toISOString()
          const signatureHeader = item.signature_header || null
          const retryCount = item.retry_count ?? 0
          const orderId = item.order_id
          const orderStatus = item.order_status || 'pending'
          const previousStatus = item.previous_status || null
          const rawPayload = item.raw_payload || JSON.stringify(item)

          if (!orderId) {
            errors++
            continue
          }

          const { valid, expired: isExpired } = verifySignature(rawPayload, signatureHeader)
          let signatureStatus: string
          if (!signatureHeader) {
            signatureStatus = 'invalid'
          } else if (isExpired) {
            signatureStatus = 'expired'
            expired++
          } else if (valid) {
            signatureStatus = 'valid'
          } else {
            signatureStatus = 'invalid'
          }

          const { isDuplicate } = checkIdempotency(orderId, id, db)
          const isRegression = detectStatusRegression(previousStatus, orderStatus)

          let processingResult = item.processing_result || 'pending'
          let confirmStatus = item.confirm_status || 'pending'

          if (isDuplicate) {
            processingResult = 'duplicate'
            confirmStatus = 'pending'
            duplicates++
          }

          if (isRegression) {
            processingResult = 'pending'
            confirmStatus = 'pending'
            regressions++
          }

          if (signatureStatus === 'expired' || signatureStatus === 'invalid') {
            confirmStatus = 'pending'
          }

          insertStmt.run(
            id, webhookId, timestamp, signatureHeader, signatureStatus,
            retryCount, orderId, orderStatus, previousStatus,
            processingResult, confirmStatus, rawPayload
          )
          imported++
        } catch {
          errors++
        }
      }
    })

    insertTransaction(records)

    res.json({
      success: true,
      summary: { imported, duplicates, regressions, expired, errors },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Import failed' })
  }
})

router.get('/:id', (req, res) => {
  try {
    const callback = db.prepare('SELECT * FROM callback_records WHERE id = ?').get(req.params.id)
    if (!callback) {
      res.status(404).json({ success: false, error: 'Callback not found' })
      return
    }
    res.json(callback)
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch callback' })
  }
})

router.patch('/:id/confirm', (req, res) => {
  try {
    const { confirm_status, confirm_note } = req.body
    if (!confirm_status) {
      res.status(400).json({ success: false, error: 'confirm_status is required' })
      return
    }

    const existing = db.prepare('SELECT id FROM callback_records WHERE id = ?').get(req.params.id)
    if (!existing) {
      res.status(404).json({ success: false, error: 'Callback not found' })
      return
    }

    db.prepare(
      "UPDATE callback_records SET confirm_status = ?, confirm_note = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(confirm_status, confirm_note || null, req.params.id)

    const updated = db.prepare('SELECT * FROM callback_records WHERE id = ?').get(req.params.id)
    res.json(updated)
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update confirmation' })
  }
})

export default router
