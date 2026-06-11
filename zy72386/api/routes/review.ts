import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db.js'

const router = Router()

router.get('/batch/:importId', (req: Request, res: Response): void => {
  try {
    const db = getDb()
    const { importId } = req.params

    const batchInfo = db.prepare('SELECT * FROM imports WHERE id = ?').get(importId) as Record<string, unknown> | undefined
    if (!batchInfo) {
      res.status(404).json({ success: false, error: 'Import not found' })
      return
    }

    const records = db.prepare('SELECT * FROM records WHERE import_id = ?').all(importId) as Record<string, unknown>[]
    const recordIds = records.map(r => r.id)

    let manualEdits: Record<string, unknown>[] = []
    let sensorChanges: Record<string, unknown>[] = []

    if (recordIds.length > 0) {
      const placeholders = recordIds.map(() => '?').join(',')
      manualEdits = db.prepare(
        `SELECT * FROM manual_edits WHERE record_id IN (${placeholders})`
      ).all(...recordIds) as Record<string, unknown>[]
      sensorChanges = db.prepare(
        'SELECT * FROM sensor_id_changes WHERE import_id = ?'
      ).all(importId) as Record<string, unknown>[]
    }

    res.json({
      success: true,
      data: { batchInfo, records, manualEdits, sensorChanges },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.put('/record/:recordId', (req: Request, res: Response): void => {
  try {
    const db = getDb()
    const { recordId } = req.params
    const { status, current_step, operator } = req.body

    const record = db.prepare('SELECT * FROM records WHERE id = ?').get(recordId) as Record<string, unknown> | undefined
    if (!record) {
      res.status(404).json({ success: false, error: 'Record not found' })
      return
    }

    const updates: string[] = []
    const values: unknown[] = []

    if (status !== undefined) {
      updates.push('status = ?')
      values.push(status)
    }
    if (current_step !== undefined) {
      updates.push('current_step = ?')
      values.push(current_step)
    }

    updates.push("updated_at = datetime('now')")
    values.push(recordId)

    db.prepare(`UPDATE records SET ${updates.join(', ')} WHERE id = ?`).run(...values)

    const auditOp = operator || 'unknown'
    db.prepare(
      'INSERT INTO audit_log (id, record_id, import_id, action, field, old_value, new_value, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      uuidv4(), recordId, record.import_id, 'status_updated',
      'status', String(record.status), String(status ?? record.status), auditOp
    )

    res.json({ success: true, data: { recordId, status, current_step } })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.put('/sensor-change/:changeId/confirm', (req: Request, res: Response): void => {
  try {
    const db = getDb()
    const { changeId } = req.params
    const { action, reviewed_by, note } = req.body

    const change = db.prepare('SELECT * FROM sensor_id_changes WHERE id = ?').get(changeId) as Record<string, unknown> | undefined
    if (!change) {
      res.status(404).json({ success: false, error: 'Sensor change not found' })
      return
    }

    const newStatus = action === 'confirm' ? 'confirmed' : 'rejected'

    const record = db.prepare('SELECT * FROM records WHERE id = ?').get(change.record_id) as Record<string, unknown> | undefined

    db.prepare(
      "UPDATE sensor_id_changes SET status = ?, reviewed_by = ?, reviewed_at = datetime('now'), note = ? WHERE id = ?"
    ).run(newStatus, reviewed_by || 'unknown', note || null, changeId)

    if (action === 'confirm') {
      db.prepare(
        "UPDATE records SET status = 'normal', current_step = 3, updated_at = datetime('now') WHERE id = ?"
      ).run(change.record_id)

      if (record) {
        db.prepare(
          'INSERT INTO audit_log (id, record_id, import_id, action, field, old_value, new_value, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
          uuidv4(), change.record_id, change.import_id,
          'status_updated', 'status', record.status, 'normal',
          reviewed_by || 'unknown'
        )
        db.prepare(
          'INSERT INTO audit_log (id, record_id, import_id, action, field, old_value, new_value, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
          uuidv4(), change.record_id, change.import_id,
          'step_advanced', 'current_step', String(record.current_step), '3',
          reviewed_by || 'unknown'
        )
      }
    } else if (action === 'reject') {
      if (record) {
        db.prepare(
          'INSERT INTO audit_log (id, record_id, import_id, action, field, old_value, new_value, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(
          uuidv4(), change.record_id, change.import_id,
          'sensor_change_rejected', 'status', record.status, record.status,
          reviewed_by || 'unknown'
        )
      }
    }

    db.prepare(
      'INSERT INTO audit_log (id, record_id, import_id, action, field, old_value, new_value, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      uuidv4(), change.record_id, change.import_id,
      `sensor_change_${newStatus}`, 'status', change.status, newStatus,
      reviewed_by || 'unknown'
    )

    res.json({ success: true, data: { changeId, status: newStatus } })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.put('/record/:recordId/edit', (req: Request, res: Response): void => {
  try {
    const db = getDb()
    const { recordId } = req.params
    const { field, new_value, edited_by } = req.body

    const record = db.prepare('SELECT * FROM records WHERE id = ?').get(recordId) as Record<string, unknown> | undefined
    if (!record) {
      res.status(404).json({ success: false, error: 'Record not found' })
      return
    }

    const params = JSON.parse(String(record.nameplate_params || '{}'))
    const oldValue = params[field] !== undefined ? String(params[field]) : null
    params[field] = new_value

    db.prepare(
      "UPDATE records SET nameplate_params = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(JSON.stringify(params), recordId)

    db.prepare(
      'INSERT INTO manual_edits (id, record_id, field, old_value, new_value, edited_by) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(uuidv4(), recordId, field, oldValue, String(new_value), edited_by || 'unknown')

    db.prepare(
      'INSERT INTO audit_log (id, record_id, import_id, action, field, old_value, new_value, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      uuidv4(), recordId, record.import_id,
      'manual_edit', field, oldValue, String(new_value), edited_by || 'unknown'
    )

    res.json({ success: true, data: { recordId, field, oldValue, newValue: new_value } })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

export default router
