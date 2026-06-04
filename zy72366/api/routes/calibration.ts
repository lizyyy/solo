import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import db from '../db.js'
import { evaluateDirection } from '../direction-rules.js'

const router = Router()

const upload = multer({ storage: multer.memoryStorage() })

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function mapRow(row: Record<string, unknown>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    mapped[toCamelCase(key)] = value
  }
  return mapped
}

interface CalibrationRecordRow {
  sensor_id: string
  temperature: number
  direction: string
}

router.post('/import', upload.single('file'), (req: Request, res: Response): void => {
  try {
    const file = req.file
    if (!file) {
      res.status(400).json({ success: false, error: 'No file uploaded' })
      return
    }

    let rows: CalibrationRecordRow[] = []

    if (file.originalname.endsWith('.csv')) {
      const text = file.buffer.toString('utf-8')
      const parsed = Papa.parse<CalibrationRecordRow>(text, {
        header: true,
        skipEmptyLines: true,
      })
      rows = parsed.data
    } else if (file.originalname.endsWith('.xlsx') || file.originalname.endsWith('.xls')) {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      rows = XLSX.utils.sheet_to_json<CalibrationRecordRow>(sheet)
    } else {
      res.status(400).json({ success: false, error: 'Unsupported file format' })
      return
    }

    const insert = db.prepare(`
      INSERT INTO calibration_records (original_line_number, sensor_id, temperature, direction, direction_normalized, direction_status)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    let imported = 0
    let abnormal = 0
    let pending_review = 0

    const transaction = db.transaction(() => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const lineNumber = i + 1
        const direction = String(row.direction ?? '').trim()
        const sensorId = String(row.sensor_id ?? '').trim()
        const temperature = Number(row.temperature)

        if (!sensorId || !direction || isNaN(temperature)) continue

        const { normalizedValue, status } = evaluateDirection(direction)

        insert.run(lineNumber, sensorId, temperature, direction, normalizedValue, status)

        imported++
        if (status === 'abnormal') abnormal++
        if (status === 'pending_review') pending_review++
      }
    })

    transaction()

    res.json({ success: true, imported, abnormal, pending_review })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Import failed' })
  }
})
router.get('/records', (req: Request, res: Response): void => {
  try {
    const { status, direction_status, page = '1', pageSize = '20' } = req.query

    let where = 'WHERE 1=1'
    const params: unknown[] = []

    if (status) {
      where += ' AND status = ?'
      params.push(status)
    }
    if (direction_status) {
      where += ' AND direction_status = ?'
      params.push(direction_status)
    }

    const totalRow = db.prepare(`SELECT COUNT(*) as count FROM calibration_records ${where}`).get(...params) as { count: number }
    const total = totalRow.count

    const pageNum = Math.max(1, Number(page))
    const pageSizeNum = Math.max(1, Number(pageSize))
    const offset = (pageNum - 1) * pageSizeNum

    const rows = db.prepare(`
      SELECT * FROM calibration_records ${where}
      ORDER BY id DESC
      LIMIT ? OFFSET ?
    `).all(...params, pageSizeNum, offset) as Record<string, unknown>[]

    res.json({
      data: rows.map(mapRow),
      total,
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Query failed' })
  }
})

router.patch('/records/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { field_name, new_value, reason, changed_by, role } = req.body

    if (!field_name || new_value === undefined || !reason || !changed_by || !role) {
      res.status(400).json({ success: false, error: 'Missing required fields' })
      return
    }

    const record = db.prepare('SELECT * FROM calibration_records WHERE id = ?').get(id) as Record<string, unknown> | undefined
    if (!record) {
      res.status(404).json({ success: false, error: 'Record not found' })
      return
    }

    const dbFieldName = field_name.replace(/([A-Z])/g, '_$1').toLowerCase()
    const oldValue = String(record[dbFieldName] ?? '')

    let directionNormalized = record.direction_normalized as string | null
    let directionStatus = record.direction_status as string

    if (field_name === 'direction') {
      const evaluated = evaluateDirection(String(new_value))
      directionNormalized = evaluated.normalizedValue
      directionStatus = evaluated.status
    }

    db.transaction(() => {
      db.prepare(`
        UPDATE calibration_records
        SET ${dbFieldName} = ?, direction_normalized = ?, direction_status = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(String(new_value), directionNormalized, directionStatus, id)

      db.prepare(`
        INSERT INTO audit_logs (record_id, field_name, old_value, new_value, changed_by, role, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(Number(id), field_name, oldValue, String(new_value), changed_by, role, reason)
    })()

    const updated = db.prepare('SELECT * FROM calibration_records WHERE id = ?').get(id) as Record<string, unknown>
    res.json({ success: true, data: mapRow(updated) })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Update failed' })
  }
})
router.get('/records/:id/audit', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const logs = db.prepare(
      'SELECT * FROM audit_logs WHERE record_id = ? ORDER BY created_at DESC'
    ).all(id) as Record<string, unknown>[]
    res.json({ data: logs.map(mapRow) })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Query failed' })
  }
})

router.post('/records/:id/rollback', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { audit_log_id, reason, changed_by } = req.body

    if (!audit_log_id || !reason || !changed_by) {
      res.status(400).json({ success: false, error: 'Missing required fields' })
      return
    }

    const auditLog = db.prepare('SELECT * FROM audit_logs WHERE id = ? AND record_id = ?').get(audit_log_id, id) as Record<string, unknown> | undefined
    if (!auditLog) {
      res.status(404).json({ success: false, error: 'Audit log not found' })
      return
    }

    const fieldName = auditLog.field_name as string
    const oldValue = auditLog.old_value as string
    const dbFieldName = fieldName.replace(/([A-Z])/g, '_$1').toLowerCase()

    let directionNormalized: string | null = null
    let directionStatus = 'normal'

    if (fieldName === 'direction') {
      const evaluated = evaluateDirection(oldValue)
      directionNormalized = evaluated.normalizedValue
      directionStatus = evaluated.status
    } else {
      const record = db.prepare('SELECT direction_normalized, direction_status FROM calibration_records WHERE id = ?').get(id) as Record<string, unknown>
      directionNormalized = record.direction_normalized as string | null
      directionStatus = record.direction_status as string
    }

    db.transaction(() => {
      db.prepare(`
        UPDATE calibration_records
        SET ${dbFieldName} = ?, direction_normalized = ?, direction_status = ?, status = 'rolled_back', updated_at = datetime('now')
        WHERE id = ?
      `).run(oldValue, directionNormalized, directionStatus, id)

      db.prepare(`
        INSERT INTO audit_logs (record_id, field_name, old_value, new_value, changed_by, role, reason)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(Number(id), fieldName, auditLog.new_value as string, oldValue, changed_by, 'lab_teacher', reason)
    })()

    const updated = db.prepare('SELECT * FROM calibration_records WHERE id = ?').get(id) as Record<string, unknown>
    res.json({ success: true, data: mapRow(updated) })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Rollback failed' })
  }
})

export default router
