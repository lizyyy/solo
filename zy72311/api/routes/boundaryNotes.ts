import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db/database.js'

const router = Router()

router.get('/', (_req: Request, res: Response): void => {
  const db = getDb()
  const notes = db.prepare('SELECT * FROM boundary_notes ORDER BY created_at DESC').all()
  res.json({ success: true, data: { notes } })
})

router.get('/:id', (req: Request, res: Response): void => {
  const db = getDb()
  const note = db.prepare('SELECT * FROM boundary_notes WHERE id = ?').get(req.params.id)

  if (!note) {
    res.status(404).json({ success: false, error: 'Boundary note not found' })
    return
  }

  const relatedRecords = db.prepare(`
    SELECT * FROM questionnaire_raw
    WHERE target_name IN (SELECT value FROM json_each(boundary_notes.related_fields))
    AND boundary_notes.id = ?
  `).all?.(req.params.id) ?? []

  const relatedFieldNames = JSON.parse((note as any).related_fields || '[]') as string[]
  const qrRecords = relatedFieldNames.length > 0
    ? db.prepare(`SELECT * FROM questionnaire_raw WHERE target_name IN (${relatedFieldNames.map(() => '?').join(',')})`).all(...relatedFieldNames)
    : []

  res.json({ success: true, data: { note, relatedRecords: qrRecords } })
})

router.post('/supplement', (req: Request, res: Response): void => {
  const { noteId, targetField, supplementValue, reason } = req.body as {
    noteId: string
    targetField: string
    supplementValue: string
    reason: string
  }

  if (!noteId || !targetField || !supplementValue || !reason) {
    res.status(400).json({ success: false, error: 'noteId, targetField, supplementValue and reason are required' })
    return
  }

  const db = getDb()
  const now = new Date().toISOString()

  const note = db.prepare('SELECT * FROM boundary_notes WHERE id = ?').get(noteId) as any
  if (!note) {
    res.status(404).json({ success: false, error: 'Boundary note not found' })
    return
  }

  const existingRecord = db.prepare(
    "SELECT * FROM questionnaire_raw WHERE target_name = ? AND record_type != 'supplemented' ORDER BY created_at DESC LIMIT 1"
  ).get(targetField) as any

  const recordId = uuidv4()
  const parsedValue = parseFloat(supplementValue) || 0
  let conflictDetected = false
  let conflictId: string | undefined

  const insertQr = db.prepare(`
    INSERT INTO questionnaire_raw (id, batch_id, target_name, weight, score, denominator, raw_value, record_type, source, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertConflict = db.prepare(`
    INSERT INTO conflicts (id, questionnaire_record_id, boundary_note_id, field_name, questionnaire_value, boundary_note_value, diff_description, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, operator, action, target_type, target_id, before_value, after_value, reason, affected_results, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const transaction = db.transaction(() => {
    insertQr.run(
      recordId, existingRecord?.batch_id || 'supplement-batch', targetField,
      existingRecord?.weight ?? 0, parsedValue, existingRecord?.denominator ?? 100,
      `${targetField},${existingRecord?.weight ?? 0},${parsedValue},${existingRecord?.denominator ?? 100}`,
      'supplemented', 'boundary_note', 'pending', now
    )

    if (existingRecord) {
      const qValue = String(existingRecord.score ?? '')
      const bValue = String(parsedValue)

      if (qValue !== bValue) {
        conflictDetected = true
        conflictId = uuidv4()

        insertConflict.run(
          conflictId, existingRecord.id, noteId, 'score',
          qValue, bValue,
          `问卷原始值(${qValue})与边界值说明补录值(${bValue})不一致`,
          'pending', now
        )
      }
    }

    insertAudit.run(
      uuidv4(), 'analyst', 'supplement', 'questionnaire', recordId,
      existingRecord ? JSON.stringify({ score: existingRecord.score }) : null,
      JSON.stringify({ score: parsedValue, source: 'boundary_note' }),
      reason,
      JSON.stringify(conflictDetected ? [recordId, existingRecord?.id, conflictId].filter(Boolean) : [recordId]),
      now
    )
  })

  transaction()

  res.json({
    success: true,
    data: {
      recordId,
      conflictDetected,
      conflictId,
    },
  })
})

export default router
