import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import { tmpdir } from 'os'
import { join, extname } from 'path'
import { readFileSync, unlinkSync, mkdirSync } from 'fs'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db.js'

const router = Router()

const UPLOAD_DIR = join(tmpdir(), 'grain-vent-uploads')
mkdirSync(UPLOAD_DIR, { recursive: true })

const upload = multer({ dest: UPLOAD_DIR })

router.post('/upload', upload.single('file'), (req: Request, res: Response): void => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' })
      return
    }

    const file = req.file
    const ext = extname(file.originalname).toLowerCase()
    const operator = req.body.operator || 'unknown'
    const batchLabel = req.body.batch_label || file.originalname

    let rows: Record<string, unknown>[] = []

    if (ext === '.csv') {
      const content = readFileSync(file.path, 'utf-8')
      const result = Papa.parse(content, { header: true, skipEmptyLines: true })
      rows = result.data as Record<string, unknown>[]
    } else if (ext === '.xlsx' || ext === '.xls') {
      const workbook = XLSX.readFile(file.path)
      const sheetName = workbook.SheetNames[0]
      rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName])
    } else {
      try { unlinkSync(file.path) } catch { /* ignore cleanup errors */ }
      res.status(400).json({ success: false, error: 'Unsupported file format' })
      return
    }

    try { unlinkSync(file.path) } catch { /* ignore cleanup errors */ }

    const db = getDb()
    const importId = uuidv4()
    let duplicateRows = 0
    let anomalyCount = 0
    const seenSensorIds = new Set<string>()

    const transaction = db.transaction(() => {
      db.prepare(
        'INSERT INTO imports (id, batch_label, file_name, total_rows, duplicate_rows, anomaly_count, operator) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(importId, batchLabel, file.originalname, rows.length, 0, 0, operator)

      const insertRecord = db.prepare(
        'INSERT INTO records (id, import_id, original_row_number, sensor_id, previous_sensor_id, nameplate_params, status, current_step) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      const insertSensorChange = db.prepare(
        'INSERT INTO sensor_id_changes (id, record_id, import_id, old_sensor_id, new_sensor_id, status, stuck_at_step) VALUES (?, ?, ?, ?, ?, ?, ?)'
      )
      const insertAudit = db.prepare(
        'INSERT INTO audit_log (id, record_id, import_id, action, field, old_value, new_value, operator) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      )
      const findExistingSensor = db.prepare(
        'SELECT id, sensor_id FROM records WHERE sensor_id = ? LIMIT 1'
      )

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const sensorId = String(row['sensor_id'] ?? row['传感器ID'] ?? '')
        if (!sensorId) continue

        const recordId = uuidv4()
        let status = 'normal'
        let previousSensorId: string | null = null
        let currentStep = 1

        if (seenSensorIds.has(sensorId)) {
          duplicateRows++
          status = 'anomaly'
          anomalyCount++
        } else {
          seenSensorIds.add(sensorId)
        }

        const existing = findExistingSensor.get(sensorId) as { id: string; sensor_id: string } | undefined
        if (existing) {
          status = 'sensor_id_changed'
          previousSensorId = existing.sensor_id
          currentStep = 2
          anomalyCount++
        }

        const nameplateParams = JSON.stringify(row)
        insertRecord.run(recordId, importId, i + 1, sensorId, previousSensorId, nameplateParams, status, currentStep)

        if (existing) {
          const changeId = uuidv4()
          insertSensorChange.run(changeId, recordId, importId, existing.sensor_id, sensorId, 'pending_review', 2)
          insertAudit.run(uuidv4(), recordId, importId, 'sensor_id_changed', 'sensor_id', existing.sensor_id, sensorId, operator)
        }

        insertAudit.run(uuidv4(), recordId, importId, 'record_created', null, null, null, operator)
      }

      db.prepare(
        'UPDATE imports SET total_rows = ?, duplicate_rows = ?, anomaly_count = ? WHERE id = ?'
      ).run(rows.length, duplicateRows, anomalyCount, importId)
    })

    transaction()

    res.json({
      success: true,
      data: {
        importId,
        totalRows: rows.length,
        duplicateRows,
        anomalies: anomalyCount,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

router.get('/history', (_req: Request, res: Response): void => {
  try {
    const db = getDb()
    const imports = db.prepare('SELECT * FROM imports ORDER BY created_at DESC').all()
    res.json({ success: true, data: imports })
  } catch (error) {
    res.status(500).json({ success: false, error: String(error) })
  }
})

export default router
