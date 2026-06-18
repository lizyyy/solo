import { Router, type Request, type Response } from 'express'
import db from '../db.js'

const router = Router()

interface AnomalyRecord {
  id: string
  run_id: string
  record_id: string
  anomaly_type: string
  severity: string
  description: string
  trace_chain: string
  summary_mapping: string
  status: string
}

interface CoordinateCorrection {
  id: string
  anomaly_id: string
  original_lat: number
  original_lng: number
  corrected_lat: number
  corrected_lng: number
  persisted_to_detail: number
  persisted_to_file: number
  corrected_at: string
}

interface Annotation {
  id: string
  record_id: string
  annotator: string
  content: string
  annotation_time: string
  is_retroactive: number
}

router.get('/', (req: Request, res: Response): void => {
  try {
    const { run_id, anomaly_type, severity, status } = req.query

    let sql = 'SELECT * FROM anomaly_records WHERE 1=1'
    const params: unknown[] = []

    if (run_id) {
      sql += ' AND run_id = ?'
      params.push(run_id)
    }
    if (anomaly_type) {
      sql += ' AND anomaly_type = ?'
      params.push(anomaly_type)
    }
    if (severity) {
      sql += ' AND severity = ?'
      params.push(severity)
    }
    if (status) {
      sql += ' AND status = ?'
      params.push(status)
    }

    sql += ' ORDER BY CASE severity WHEN \'critical\' THEN 0 WHEN \'warning\' THEN 1 WHEN \'info\' THEN 2 END, id'

    const anomalies = db.prepare(sql).all(...params) as AnomalyRecord[]

    const correctionMap: Record<string, CoordinateCorrection> = {}
    const annotationsMap: Record<string, Annotation[]> = {}
    if (anomalies.length > 0) {
      const placeholders = anomalies.map(() => '?').join(',')
      const anomalyIds = anomalies.map(a => a.id)
      const recordIds = anomalies.map(a => a.record_id)

      const corrections = db.prepare(`SELECT * FROM coordinate_corrections WHERE anomaly_id IN (${placeholders})`).all(...anomalyIds) as CoordinateCorrection[]
      for (const c of corrections) correctionMap[c.anomaly_id] = c

      const recordPlaceholders = recordIds.map(() => '?').join(',')
      const allAnnotations = db.prepare(`SELECT * FROM annotations WHERE record_id IN (${recordPlaceholders})`).all(...recordIds) as Annotation[]
      for (const a of allAnnotations) {
        if (!annotationsMap[a.record_id]) annotationsMap[a.record_id] = []
        annotationsMap[a.record_id].push(a)
      }
    }

    res.json({
      success: true,
      data: anomalies.map(a => ({
        ...a,
        trace_chain: JSON.parse(a.trace_chain),
        summary_mapping: JSON.parse(a.summary_mapping),
        coordinate_correction: correctionMap[a.id] || null,
        record_annotations: annotationsMap[a.record_id] || [],
      })),
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch anomalies' })
  }
})

router.patch('/:id/persist', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { target } = req.body as { target: 'detail' | 'file' | 'both' }

    if (!target || !['detail', 'file', 'both'].includes(target)) {
      res.status(400).json({ success: false, error: 'target must be detail, file, or both' })
      return
    }

    const existing = db.prepare('SELECT id FROM coordinate_corrections WHERE anomaly_id = ?').get(id) as { id: string } | undefined
    if (!existing) {
      res.status(404).json({ success: false, error: 'Coordinate correction not found' })
      return
    }

    if (target === 'detail' || target === 'both') {
      db.prepare('UPDATE coordinate_corrections SET persisted_to_detail = 1 WHERE anomaly_id = ?').run(id)
    }
    if (target === 'file' || target === 'both') {
      db.prepare('UPDATE coordinate_corrections SET persisted_to_file = 1 WHERE anomaly_id = ?').run(id)
    }

    const updated = db.prepare('SELECT * FROM coordinate_corrections WHERE anomaly_id = ?').get(id) as CoordinateCorrection
    res.json({
      success: true,
      data: updated,
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to persist coordinate correction' })
  }
})

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const anomaly = db.prepare('SELECT * FROM anomaly_records WHERE id = ?').get(id) as AnomalyRecord | undefined

    if (!anomaly) {
      res.status(404).json({ success: false, error: 'Anomaly not found' })
      return
    }

    const correction = db.prepare('SELECT * FROM coordinate_corrections WHERE anomaly_id = ?').get(id) as CoordinateCorrection | undefined
    const annotations = db.prepare('SELECT * FROM annotations WHERE record_id = ?').all(anomaly.record_id) as Annotation[]

    res.json({
      success: true,
      data: {
        ...anomaly,
        trace_chain: JSON.parse(anomaly.trace_chain),
        summary_mapping: JSON.parse(anomaly.summary_mapping),
        coordinate_correction: correction || null,
        record_annotations: annotations,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch anomaly' })
  }
})

router.patch('/:id/status', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { status } = req.body

    if (!status || !['open', 'acknowledged', 'resolved'].includes(status)) {
      res.status(400).json({ success: false, error: 'status must be open, acknowledged, or resolved' })
      return
    }

    const existing = db.prepare('SELECT id FROM anomaly_records WHERE id = ?').get(id) as { id: string } | undefined
    if (!existing) {
      res.status(404).json({ success: false, error: 'Anomaly not found' })
      return
    }

    db.prepare('UPDATE anomaly_records SET status = ? WHERE id = ?').run(status, id)

    const updated = db.prepare('SELECT * FROM anomaly_records WHERE id = ?').get(id) as AnomalyRecord

    res.json({
      success: true,
      data: {
        ...updated,
        trace_chain: JSON.parse(updated.trace_chain),
        summary_mapping: JSON.parse(updated.summary_mapping),
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update anomaly status' })
  }
})

export default router
