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

interface ReportRun {
  id: string
  run_time: string
  parameter_snapshot_id: string | null
  status: string
  total_records: number
  anomaly_count: number
}

router.post('/', (req: Request, res: Response): void => {
  try {
    const { run_id, include_annotations, include_coordinate_corrections, format } = req.body

    if (!run_id) {
      res.status(400).json({ success: false, error: 'run_id is required' })
      return
    }

    const run = db.prepare('SELECT * FROM report_runs WHERE id = ?').get(run_id) as ReportRun | undefined
    if (!run) {
      res.status(404).json({ success: false, error: 'Run not found' })
      return
    }

    const anomalies = db.prepare('SELECT * FROM anomaly_records WHERE run_id = ?').all(run_id) as AnomalyRecord[]

    let corrections: CoordinateCorrection[] = []
    if (include_coordinate_corrections) {
      corrections = db.prepare(`
        SELECT cc.* FROM coordinate_corrections cc
        JOIN anomaly_records ar ON cc.anomaly_id = ar.id
        WHERE ar.run_id = ?
      `).all(run_id) as CoordinateCorrection[]

      db.prepare(`
        UPDATE coordinate_corrections SET persisted_to_file = 1
        WHERE id IN (
          SELECT cc.id FROM coordinate_corrections cc
          JOIN anomaly_records ar ON cc.anomaly_id = ar.id
          WHERE ar.run_id = ?
        )
      `).run(run_id)
    }

    const byType: Record<string, number> = {}
    const bySeverity: Record<string, number> = {}
    const byStatus: Record<string, number> = {}
    for (const a of anomalies) {
      byType[a.anomaly_type] = (byType[a.anomaly_type] || 0) + 1
      bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1
      byStatus[a.status] = (byStatus[a.status] || 0) + 1
    }

    const anomalyQueue = anomalies.map(a => {
      const item: Record<string, unknown> = {
        id: a.id,
        anomaly_type: a.anomaly_type,
        severity: a.severity,
        description: a.description,
        trace_chain: JSON.parse(a.trace_chain),
        summary_mapping: JSON.parse(a.summary_mapping),
        status: a.status,
        record_id: a.record_id,
      }

      if (include_coordinate_corrections) {
        const correction = corrections.find(c => c.anomaly_id === a.id)
        if (correction) {
          item.coordinate_correction = {
            original_lat: correction.original_lat,
            original_lng: correction.original_lng,
            corrected_lat: correction.corrected_lat,
            corrected_lng: correction.corrected_lng,
            persisted_to_detail: correction.persisted_to_detail,
            persisted_to_file: 1,
          }
        }
      }

      if (include_annotations) {
        const annotations = db.prepare('SELECT * FROM annotations WHERE record_id = ?').all(a.record_id) as Annotation[]
        item.annotations = annotations
      }

      return item
    })

    const snapshot = run.parameter_snapshot_id
      ? db.prepare('SELECT * FROM parameter_snapshots WHERE id = ?').get(run.parameter_snapshot_id) as { id: string; parameters: string; snapshot_time: string } | undefined
      : null

    const exportData = {
      run: {
        id: run.id,
        run_time: run.run_time,
        status: run.status,
        total_records: run.total_records,
        anomaly_count: run.anomaly_count,
      },
      parameters: snapshot ? JSON.parse(snapshot.parameters) : null,
      summary_metrics: {
        total_records: run.total_records,
        anomaly_count: run.anomaly_count,
        by_type: byType,
        by_severity: bySeverity,
        by_status: byStatus,
      },
      anomaly_queue: anomalyQueue,
      export_time: new Date().toISOString(),
      format: format || 'json',
    }

    res.json({ success: true, data: exportData })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate export' })
  }
})

export default router
