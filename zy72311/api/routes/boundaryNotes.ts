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

  const relatedFieldNames = JSON.parse((note as any).related_fields || '[]') as string[]
  const qrRecords = relatedFieldNames.length > 0
    ? db.prepare(`SELECT id, batch_id, target_name, weight, score, denominator, raw_value, record_type, source, status, boundary_note_id, original_statement, next_handler, created_at FROM questionnaire_raw WHERE target_name IN (${relatedFieldNames.map(() => '?').join(',')}) ORDER BY created_at DESC`).all(...relatedFieldNames)
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
    'SELECT * FROM questionnaire_raw WHERE target_name = ? ORDER BY created_at DESC LIMIT 1'
  ).get(targetField) as any

  const parsedValue = parseFloat(supplementValue) || 0
  const originalStatement = note.content ? note.content.substring(0, 100) : ''
  let conflictDetected = false
  let conflictId: string | undefined
  let recordId: string

  const insertQr = db.prepare(`
    INSERT INTO questionnaire_raw (id, batch_id, target_name, weight, score, denominator, raw_value, record_type, source, status, boundary_note_id, original_statement, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const updateQr = db.prepare(`
    UPDATE questionnaire_raw SET score = ?, source = ?, status = ?, record_type = ?, boundary_note_id = ?, original_statement = ?, created_at = ? WHERE id = ?
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
    const affectedResults: string[] = []
    let beforeValue: string | null = null
    let afterValue: string

    if (!existingRecord) {
      recordId = uuidv4()
      insertQr.run(
        recordId, 'boundary-supplement', targetField,
        0, parsedValue, 100,
        `${targetField},0,${parsedValue},100`,
        'supplemented', 'boundary_note', 'pending',
        noteId, originalStatement, now
      )
      beforeValue = null
      afterValue = JSON.stringify({
        score: parsedValue,
        source: 'boundary_note',
        boundaryNoteId: noteId,
        originalStatement
      })
      affectedResults.push(recordId)
    } else {
      recordId = existingRecord.id
      const oldScore = existingRecord.score
      const oldSource = existingRecord.source
      const oldStatus = existingRecord.status
      const oldRecordType = existingRecord.record_type

      updateQr.run(
        parsedValue, 'boundary_note', 'pending', 'supplemented',
        noteId, originalStatement, now,
        existingRecord.id
      )

      beforeValue = JSON.stringify({
        score: oldScore,
        source: oldSource,
        status: oldStatus,
        recordType: oldRecordType
      })
      afterValue = JSON.stringify({
        score: parsedValue,
        source: 'boundary_note',
        recordType: 'supplemented',
        boundaryNoteId: noteId,
        originalStatement
      })
      affectedResults.push(existingRecord.id)

      const qValue = String(oldScore ?? '')
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
        affectedResults.push(conflictId)
      }
    }

    insertAudit.run(
      uuidv4(), 'analyst', 'supplement', 'questionnaire', recordId,
      beforeValue,
      afterValue,
      reason,
      JSON.stringify(affectedResults),
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
