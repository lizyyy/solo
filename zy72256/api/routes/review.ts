import { Router, type Request, type Response } from 'express'
import { getDb } from '../database.js'
import { createAuditLog } from '../services/auditService.js'
import type { CoordinateRecord, ReviewRequest } from '../../shared/types.js'

const router = Router()

router.post('/review', (req: Request, res: Response): void => {
  const body = req.body as ReviewRequest
  const db = getDb()

  const record = db.prepare('SELECT * FROM coordinate_records WHERE id = ?').get(body.record_id) as CoordinateRecord | undefined
  if (!record) {
    res.status(404).json({ success: false, error: 'Record not found' })
    return
  }

  if (body.action === 'retain') {
    if (!body.retention_reason) {
      res.status(400).json({ success: false, error: 'Retention reason is required for retain action' })
      return
    }

    db.prepare(`
      UPDATE coordinate_records
      SET status = 'pending_inspection', retention_reason = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(body.retention_reason, body.record_id)

    if (body.inspection_photo_id) {
      db.prepare('UPDATE coordinate_records SET inspection_photo_id = ? WHERE id = ?').run(body.inspection_photo_id, body.record_id)
    }

    const previousStatus = record.status
    record.status = 'pending_inspection'
    record.retention_reason = body.retention_reason
    if (body.inspection_photo_id) {
      record.inspection_photo_id = body.inspection_photo_id
    }

    createAuditLog({
      record_id: body.record_id,
      operator: body.operator,
      operator_role: 'instructor',
      action: 'retain',
      previous_status: previousStatus,
      new_status: 'pending_inspection',
      change_detail: `Retained with reason: ${body.retention_reason}`,
      snapshot: record,
    })
  } else if (body.action === 'correct') {
    const correctedType = body.corrected_type || record.coordinate_type

    db.prepare(`
      UPDATE coordinate_records
      SET status = 'corrected', coordinate_type = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(correctedType, body.record_id)

    if (body.inspection_photo_id) {
      db.prepare('UPDATE coordinate_records SET inspection_photo_id = ? WHERE id = ?').run(body.inspection_photo_id, body.record_id)
    }

    const previousStatus = record.status
    const previousType = record.coordinate_type
    record.status = 'corrected'
    record.coordinate_type = correctedType
    if (body.inspection_photo_id) {
      record.inspection_photo_id = body.inspection_photo_id
    }

    createAuditLog({
      record_id: body.record_id,
      operator: body.operator,
      operator_role: 'instructor',
      action: 'correct',
      previous_status: previousStatus,
      new_status: 'corrected',
      change_detail: `Corrected coordinate type from ${previousType} to ${correctedType}`,
      snapshot: record,
    })
  }

  const updated = db.prepare('SELECT * FROM coordinate_records WHERE id = ?').get(body.record_id) as CoordinateRecord
  res.json({ success: true, data: updated })
})

router.post('/confirm', (req: Request, res: Response): void => {
  const { record_id, operator } = req.body as { record_id: string; operator: string }
  const db = getDb()

  const record = db.prepare('SELECT * FROM coordinate_records WHERE id = ?').get(record_id) as CoordinateRecord | undefined
  if (!record) {
    res.status(404).json({ success: false, error: 'Record not found' })
    return
  }

  const previousStatus = record.status

  db.prepare(`
    UPDATE coordinate_records
    SET status = 'confirmed', updated_at = datetime('now')
    WHERE id = ?
  `).run(record_id)

  record.status = 'confirmed'

  createAuditLog({
    record_id,
    operator,
    operator_role: 'inspector',
    action: 'confirm',
    previous_status: previousStatus,
    new_status: 'confirmed',
    change_detail: 'Record confirmed by inspector',
    snapshot: record,
  })

  const updated = db.prepare('SELECT * FROM coordinate_records WHERE id = ?').get(record_id) as CoordinateRecord
  res.json({ success: true, data: updated })
})

export default router
