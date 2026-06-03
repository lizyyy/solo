import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import { parse } from 'csv-parse'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../database.js'
import { detectCoordinateType, parseCoordinates } from '../services/coordinateDetector.js'
import { createAuditLog } from '../services/auditService.js'
import type { CoordinateRecord, ImportResponse, StatsResponse } from '../../shared/types.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage() })

router.get('/records', (req: Request, res: Response): void => {
  const db = getDb()
  const { status, type } = req.query

  let sql = 'SELECT * FROM coordinate_records WHERE 1=1'
  const params: unknown[] = []

  if (status) {
    sql += ' AND status = ?'
    params.push(status)
  }
  if (type) {
    sql += ' AND coordinate_type = ?'
    params.push(type)
  }

  sql += ' ORDER BY original_line_number ASC'

  const records = db.prepare(sql).all(...params) as CoordinateRecord[]
  res.json({ success: true, data: records })
})

router.get('/records/:id', (req: Request, res: Response): void => {
  const db = getDb()
  const record = db.prepare('SELECT * FROM coordinate_records WHERE id = ?').get(req.params.id) as CoordinateRecord | undefined

  if (!record) {
    res.status(404).json({ success: false, error: 'Record not found' })
    return
  }

  const photos = db.prepare('SELECT * FROM inspection_photos WHERE record_id = ?').all(req.params.id)
  res.json({ success: true, data: { ...record, photos } })
})

router.post('/import', upload.single('file'), (req: Request, res: Response): void => {
  if (!req.file) {
    res.status(400).json({ success: false, error: 'No file uploaded' })
    return
  }

  const db = getDb()
  const csvContent = req.file.buffer.toString('utf-8')

  parse(csvContent, { columns: true, skip_empty_lines: true, trim: true }, (err, rows: { building_name: string; coordinate_origin_description: string }[]) => {
    if (err) {
      res.status(400).json({ success: false, error: 'Invalid CSV format' })
      return
    }

    const result: ImportResponse = {
      total_rows: 0,
      normal_count: 0,
      mixed_count: 0,
      records: [],
    }

    const insertRecord = db.prepare(`
      INSERT INTO coordinate_records (id, original_line_number, building_name, coordinate_origin_description, coordinate_type, raw_latitude, raw_longitude, raw_metric_x, raw_metric_y, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review')
    `)

    const transaction = db.transaction(() => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const id = uuidv4()
        const lineNumber = i + 1
        const coordinateType = detectCoordinateType(row.coordinate_origin_description)
        const coords = parseCoordinates(row.coordinate_origin_description)

        insertRecord.run(
          id,
          lineNumber,
          row.building_name,
          row.coordinate_origin_description,
          coordinateType,
          coords.raw_latitude,
          coords.raw_longitude,
          coords.raw_metric_x,
          coords.raw_metric_y,
        )

        const record: CoordinateRecord = {
          id,
          original_line_number: lineNumber,
          building_name: row.building_name,
          coordinate_origin_description: row.coordinate_origin_description,
          coordinate_type: coordinateType,
          raw_latitude: coords.raw_latitude,
          raw_longitude: coords.raw_longitude,
          raw_metric_x: coords.raw_metric_x,
          raw_metric_y: coords.raw_metric_y,
          status: 'pending_review',
          retention_reason: null,
          inspection_photo_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }

        createAuditLog({
          record_id: id,
          operator: 'system',
          operator_role: 'crew',
          action: 'import',
          previous_status: '',
          new_status: 'pending_review',
          change_detail: `Imported record: ${row.building_name}`,
          snapshot: record,
        })

        result.total_rows++
        if (coordinateType === 'mixed') {
          result.mixed_count++
        } else {
          result.normal_count++
        }
        result.records.push(record)
      }
    })

    transaction()
    res.json({ success: true, data: result })
  })
})

router.get('/stats', (_req: Request, res: Response): void => {
  const db = getDb()

  const total = (db.prepare('SELECT COUNT(*) as count FROM coordinate_records').get() as { count: number }).count

  const typeRows = db.prepare('SELECT coordinate_type, COUNT(*) as count FROM coordinate_records GROUP BY coordinate_type').all() as { coordinate_type: string; count: number }[]
  const by_type = { longitude_latitude: 0, metric: 0, mixed: 0 } as StatsResponse['by_type']
  for (const row of typeRows) {
    by_type[row.coordinate_type as keyof typeof by_type] = row.count
  }

  const statusRows = db.prepare('SELECT status, COUNT(*) as count FROM coordinate_records GROUP BY status').all() as { status: string; count: number }[]
  const by_status = { pending_review: 0, under_review: 0, pending_inspection: 0, corrected: 0, confirmed: 0 } as StatsResponse['by_status']
  for (const row of statusRows) {
    by_status[row.status as keyof typeof by_status] = row.count
  }

  res.json({ success: true, data: { total, by_type, by_status } as StatsResponse })
})

export default router
