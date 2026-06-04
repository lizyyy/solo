import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import { parse } from 'csv-parse/sync'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import { recordChange } from '../lib/auditEngine.js'
import type { SensorData, ImportResult } from '../../shared/types.js'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true)
    } else {
      cb(new Error('Only CSV files are allowed'))
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
})

router.get('/batches', async (req: Request, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20
    const offset = (page - 1) * pageSize

    const countStmt = db.prepare('SELECT COUNT(*) as cnt FROM batch')
    const total = (countStmt.get() as { cnt: number }).cnt

    const query = `
      SELECT * FROM batch
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `
    const batches = db.prepare(query).all(pageSize, offset)

    res.status(200).json({
      success: true,
      data: {
        list: batches,
        total,
        page,
        pageSize,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch batches',
    })
  }
})

router.post('/import', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' })
      return
    }

    const content = req.file.buffer.toString('utf-8')
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })

    if (records.length === 0) {
      res.status(400).json({ success: false, error: 'CSV file is empty' })
      return
    }

    const batchId = uuidv4()
    const filename = req.file.originalname
    const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '')

    const insertBatch = db.prepare(
      'INSERT INTO batch (id, filename, total_in_file, imported_count, duplicate_count, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )

    const insertSensor = db.prepare(
      'INSERT OR IGNORE INTO sensor_data (id, sensor_code, batch_id, material_type, rpm_min, rpm_max, coefficient, coefficient_manual, coefficient_reason, remark, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )

    const insertZone = db.prepare(
      'INSERT OR IGNORE INTO safety_zone (id, sensor_id, rpm_min, rpm_max, coefficient, coefficient_source, coefficient_reason, review_status, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )

    const checkDuplicate = db.prepare('SELECT COUNT(*) as cnt FROM sensor_data WHERE sensor_code = ?')

    let imported = 0
    let duplicates = 0

    const tx = db.transaction(() => {
      for (const record of records) {
        const sensorCode = record['sensor_code'] || record['传感器编号'] || ''
        const materialType = record['material_type'] || record['材质类型'] || ''
        const rpmMin = parseFloat(record['rpm_min'] || record['最小转速'] || '0')
        const rpmMax = parseFloat(record['rpm_max'] || record['最大转速'] || '0')
        const coefficient = parseFloat(record['coefficient'] || record['修正系数'] || '1.0')
        const coefficientReason = record['coefficient_reason'] || record['系数说明'] || null
        const remark = record['remark'] || record['备注'] || ''

        if (!sensorCode) continue

        const dupCheck = checkDuplicate.get(sensorCode) as { cnt: number }
        if (dupCheck.cnt > 0) {
          duplicates++
          continue
        }

        const sensorId = uuidv4()
        const result = insertSensor.run(
          sensorId,
          sensorCode,
          batchId,
          materialType,
          rpmMin,
          rpmMax,
          coefficient,
          0,
          coefficientReason,
          remark,
          now,
          now
        )

        if (result.changes > 0) {
          imported++
          insertZone.run(
            uuidv4(),
            sensorId,
            rpmMin,
            rpmMax,
            coefficient,
            'auto',
            coefficientReason,
            'approved',
            1,
            now,
            now
          )
        } else {
          duplicates++
        }
      }

      insertBatch.run(batchId, filename, records.length, imported, duplicates, now)
    })

    tx()

    const importResult: ImportResult = {
      totalInFile: records.length,
      imported,
      duplicates,
      batchId,
    }

    res.status(200).json({
      success: true,
      data: importResult,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Import failed',
    })
  }
})

router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const batchId = req.query.batchId as string | undefined
    const page = parseInt(req.query.page as string) || 1
    const pageSize = parseInt(req.query.pageSize as string) || 20
    const offset = (page - 1) * pageSize

    let whereClause = ''
    const params: unknown[] = []

    if (batchId) {
      whereClause = 'WHERE batch_id = ?'
      params.push(batchId)
    }

    const countStmt = db.prepare(`SELECT COUNT(*) as cnt FROM sensor_data ${whereClause}`)
    const total = (countStmt.get(...params) as { cnt: number }).cnt

    const query = `
      SELECT s.*, b.filename as batch_filename
      FROM sensor_data s
      LEFT JOIN batch b ON s.batch_id = b.id
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `
    const sensors = db.prepare(query).all(...params, pageSize, offset) as Array<SensorData & { batch_filename: string }>

    res.status(200).json({
      success: true,
      data: {
        list: sensors,
        total,
        page,
        pageSize,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch sensors',
    })
  }
})

router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const sensor = db
      .prepare(
        `
      SELECT s.*, b.filename as batch_filename
      FROM sensor_data s
      LEFT JOIN batch b ON s.batch_id = b.id
      WHERE s.id = ?
    `
      )
      .get(id) as (SensorData & { batch_filename: string }) | undefined

    if (!sensor) {
      res.status(404).json({ success: false, error: 'Sensor not found' })
      return
    }

    const photos = db.prepare('SELECT * FROM photo_meta WHERE sensor_id = ? ORDER BY uploaded_at DESC').all(id)

    res.status(200).json({
      success: true,
      data: {
        ...sensor,
        photos,
      },
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch sensor',
    })
  }
})

router.put('/:id/remark', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { remark, operator = 'system', reason } = req.body

    if (typeof remark !== 'string') {
      res.status(400).json({ success: false, error: 'Remark is required' })
      return
    }

    const sensor = db.prepare('SELECT * FROM sensor_data WHERE id = ?').get(id) as SensorData | undefined

    if (!sensor) {
      res.status(404).json({ success: false, error: 'Sensor not found' })
      return
    }

    const oldRemark = sensor.remark
    const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '')

    db.prepare('UPDATE sensor_data SET remark = ?, updated_at = ? WHERE id = ?').run(remark, now, id)

    recordChange({
      targetType: 'sensor',
      targetId: id,
      field: 'remark',
      oldValue: oldRemark,
      newValue: remark,
      operator,
      reason,
    })

    const updatedSensor = db.prepare('SELECT * FROM sensor_data WHERE id = ?').get(id)

    res.status(200).json({
      success: true,
      data: updatedSensor,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update remark',
    })
  }
})

router.put('/:id/coefficient', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params
    const { coefficient, reason, operator = 'system' } = req.body

    if (typeof coefficient !== 'number' || isNaN(coefficient)) {
      res.status(400).json({ success: false, error: 'Valid coefficient is required' })
      return
    }

    const sensor = db.prepare('SELECT * FROM sensor_data WHERE id = ?').get(id) as SensorData | undefined

    if (!sensor) {
      res.status(404).json({ success: false, error: 'Sensor not found' })
      return
    }

    const oldCoefficient = sensor.coefficient
    const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '')

    const coefficientManual = reason ? 1 : 1
    const reviewStatus = reason ? 'approved' : 'pending'

    const tx = db.transaction(() => {
      db.prepare(
        'UPDATE sensor_data SET coefficient = ?, coefficient_manual = ?, coefficient_reason = ?, updated_at = ? WHERE id = ?'
      ).run(coefficient, coefficientManual, reason || null, now, id)

      const zone = db.prepare('SELECT * FROM safety_zone WHERE sensor_id = ?').get(id) as any
      if (zone) {
        db.prepare(
          'UPDATE safety_zone SET coefficient = ?, coefficient_source = ?, coefficient_reason = ?, review_status = ?, updated_at = ? WHERE sensor_id = ?'
        ).run(coefficient, 'manual', reason || null, reviewStatus, now, id)

        recordChange({
          targetType: 'safety_zone',
          targetId: zone.id,
          field: 'coefficient',
          oldValue: oldCoefficient,
          newValue: coefficient,
          operator,
          reason,
        })
      }

      recordChange({
        targetType: 'sensor',
        targetId: id,
        field: 'coefficient',
        oldValue: oldCoefficient,
        newValue: coefficient,
        operator,
        reason,
      })
    })

    tx()

    const updatedSensor = db.prepare('SELECT * FROM sensor_data WHERE id = ?').get(id)

    res.status(200).json({
      success: true,
      data: updatedSensor,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update coefficient',
    })
  }
})

export default router
