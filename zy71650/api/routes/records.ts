import { Router, type Request, type Response } from 'express'
import { getDb } from '../db.js'

const router = Router()

function mapAnomaly(a: any) {
  return {
    id: a.id,
    type: a.type,
    description: a.description,
    severity: a.severity,
    affectedParam: a.affected_param,
  }
}

function mapAuditEntry(a: any) {
  return {
    id: a.id,
    recordId: a.record_id,
    operationType: a.operation_type,
    judgment: a.judgment,
    createdAt: a.created_at,
  }
}

function mapNote(n: any) {
  return {
    id: n.id,
    recordId: n.record_id,
    content: n.content,
    version: n.version,
    createdAt: n.created_at,
    isCurrent: !!n.is_current,
  }
}

function mapRecord(record: any, db: any) {
  const anomalies = (db.prepare('SELECT * FROM anomaly_flags WHERE record_id = ?').all(record.id) as any[]).map(mapAnomaly)
  const auditEntries = (db.prepare('SELECT * FROM audit_entries WHERE record_id = ? ORDER BY created_at').all(record.id) as any[]).map(mapAuditEntry)
  const notes = (db.prepare('SELECT * FROM note_versions WHERE record_id = ? ORDER BY version').all(record.id) as any[]).map(mapNote)
  const audioFile = db.prepare('SELECT * FROM audio_files WHERE id = ?').get(record.file_id) as any

  return {
    ...record,
    anomalies,
    auditEntries,
    notes,
    bpm: audioFile?.bpm ?? null,
  }
}

router.get('/', (req: Request, res: Response): void => {
  try {
    const db = getDb()
    const records = db.prepare('SELECT * FROM fitting_records ORDER BY created_at DESC').all() as any[]

    const result = records.map(record => mapRecord(record, db))

    res.status(200).json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch records' })
  }
})

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const db = getDb()

    const record = db.prepare('SELECT * FROM fitting_records WHERE id = ?').get(id) as any
    if (!record) {
      res.status(404).json({ success: false, error: 'Record not found' })
      return
    }

    const result = mapRecord(record, db)

    res.status(200).json({
      success: true,
      data: result
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch record' })
  }
})

router.get('/:id/audit', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const db = getDb()

    const record = db.prepare('SELECT * FROM fitting_records WHERE id = ?').get(id) as any
    if (!record) {
      res.status(404).json({ success: false, error: 'Record not found' })
      return
    }

    const auditEntries = (db.prepare('SELECT * FROM audit_entries WHERE record_id = ? ORDER BY created_at').all(id) as any[]).map(mapAuditEntry)
    res.status(200).json({ success: true, data: auditEntries })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch audit entries' })
  }
})

router.delete('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const db = getDb()

    const record = db.prepare('SELECT * FROM fitting_records WHERE id = ?').get(id) as any
    if (!record) {
      res.status(404).json({ success: false, error: 'Record not found' })
      return
    }

    const deleteTransaction = db.transaction(() => {
      db.prepare('DELETE FROM anomaly_flags WHERE record_id = ?').run(id)
      db.prepare('DELETE FROM audit_entries WHERE record_id = ?').run(id)
      db.prepare('DELETE FROM note_versions WHERE record_id = ?').run(id)
      db.prepare('DELETE FROM fitting_records WHERE id = ?').run(id)
    })

    deleteTransaction()

    res.status(200).json({ success: true, message: 'Record deleted successfully' })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete record' })
  }
})

export default router
