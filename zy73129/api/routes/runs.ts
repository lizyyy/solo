import { Router, type Request, type Response } from 'express'
import crypto from 'crypto'
import db from '../db.js'

const router = Router()

interface SurveyRecord {
  id: string
  site_name: string
  latitude: number
  longitude: number
  sample_time: string
  experiment_result: string
  bleaching_level: number
  source_type: string
}

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

interface ReportRun {
  id: string
  run_time: string
  parameter_snapshot_id: string | null
  status: string
  total_records: number
  anomaly_count: number
}

interface ParameterSnapshot {
  id: string
  run_id: string | null
  snapshot_time: string
  parameters: string
  changed_from: string | null
  change_step: number
  impact_summary: string | null
}

function detectAnomalies(records: SurveyRecord[], params: Record<string, unknown>): { anomalies: Omit<AnomalyRecord, 'id' | 'run_id'>[]; corrections: { anomaly_index: number; original_lat: number; original_lng: number; corrected_lat: number; corrected_lng: number }[] } {
  const anomalies: Omit<AnomalyRecord, 'id' | 'run_id'>[] = []
  const corrections: { anomaly_index: number; original_lat: number; original_lng: number; corrected_lat: number; corrected_lng: number }[] = []

  const bleachingThreshold = (params.bleaching_threshold as number) ?? 3
  const timeGapHours = (params.time_gap_hours as number) ?? 48

  for (const record of records) {
    if (Math.abs(record.latitude) > 90 || Math.abs(record.longitude) > 180) {
      const isLatSwap = Math.abs(record.latitude) > 90
      const anomaly: Omit<AnomalyRecord, 'id' | 'run_id'> = {
        record_id: record.id,
        anomaly_type: 'coordinate_swap',
        severity: 'critical',
        description: `${record.site_name} ${isLatSwap ? '纬度' : '经度'}值${isLatSwap ? record.latitude : record.longitude}超出有效范围，疑似经纬度互换`,
        trace_chain: JSON.stringify({
          record_id: record.id,
          site: record.site_name,
          original: { lat: record.latitude, lng: record.longitude },
          expected_range: { lat: [-90, 90], lng: [-180, 180] },
          violation: isLatSwap ? 'latitude > 90' : 'longitude > 180',
        }),
        summary_mapping: JSON.stringify({
          site: record.site_name,
          field: isLatSwap ? 'latitude' : 'longitude',
          value: isLatSwap ? record.latitude : record.longitude,
          corrected: isLatSwap ? record.longitude : record.latitude,
        }),
        status: 'open',
      }
      anomalies.push(anomaly)
      corrections.push({
        anomaly_index: anomalies.length - 1,
        original_lat: record.latitude,
        original_lng: record.longitude,
        corrected_lat: isLatSwap ? record.longitude : record.latitude,
        corrected_lng: isLatSwap ? record.latitude : record.longitude,
      })
    }

    const sampleMonth = record.sample_time.substring(0, 7)
    const resultMatch = record.experiment_result.match(/(\d{4}-\d{2})/)
    if (resultMatch && sampleMonth !== resultMatch[1]) {
      anomalies.push({
        record_id: record.id,
        anomaly_type: 'time_mismatch',
        severity: 'warning',
        description: `${record.site_name}采样时间${sampleMonth}与实验结果引用时间${resultMatch[1]}不一致`,
        trace_chain: JSON.stringify({
          record_id: record.id,
          site: record.site_name,
          sample_time: record.sample_time,
          result_referenced: resultMatch[1],
          mismatch_months: Math.abs(
            (parseInt(sampleMonth.substring(0, 4)) * 12 + parseInt(sampleMonth.substring(5, 7))) -
            (parseInt(resultMatch[1].substring(0, 4)) * 12 + parseInt(resultMatch[1].substring(5, 7)))
          ),
        }),
        summary_mapping: JSON.stringify({ site: record.site_name, sample_month: sampleMonth, result_month: resultMatch[1] }),
        status: 'open',
      })
    }

    if (record.bleaching_level >= bleachingThreshold) {
      anomalies.push({
        record_id: record.id,
        anomaly_type: 'bleaching_anomaly',
        severity: record.bleaching_level >= bleachingThreshold + 2 ? 'critical' : 'warning',
        description: `${record.site_name}白化等级${record.bleaching_level}级，达到或超过阈值${bleachingThreshold}`,
        trace_chain: JSON.stringify({
          record_id: record.id,
          site: record.site_name,
          bleaching_level: record.bleaching_level,
          threshold: bleachingThreshold,
          exceed_by: record.bleaching_level - bleachingThreshold,
        }),
        summary_mapping: JSON.stringify({ site: record.site_name, bleaching_level: record.bleaching_level, threshold: bleachingThreshold }),
        status: 'open',
      })
    }
  }

  const sortedBySite = [...records].sort((a, b) => a.site_name.localeCompare(b.site_name) || a.sample_time.localeCompare(b.sample_time))
  for (let i = 1; i < sortedBySite.length; i++) {
    const prev = sortedBySite[i - 1]
    const curr = sortedBySite[i]
    if (prev.site_name === curr.site_name) {
      const prevTime = new Date(prev.sample_time).getTime()
      const currTime = new Date(curr.sample_time).getTime()
      const gapHours = Math.abs(currTime - prevTime) / (1000 * 60 * 60)
      if (gapHours > timeGapHours) {
        const alreadyExists = anomalies.some(a => a.record_id === curr.id && a.anomaly_type === 'data_gap')
        if (!alreadyExists) {
          anomalies.push({
            record_id: curr.id,
            anomaly_type: 'data_gap',
            severity: 'info',
            description: `${curr.site_name}在${prev.sample_time}至${curr.sample_time}之间存在数据间隔${Math.round(gapHours)}小时`,
            trace_chain: JSON.stringify({
              record_id: curr.id,
              site: curr.site_name,
              prev_sample_time: prev.sample_time,
              curr_sample_time: curr.sample_time,
              gap_hours: Math.round(gapHours),
              threshold_hours: timeGapHours,
            }),
            summary_mapping: JSON.stringify({ site: curr.site_name, gap_start: prev.sample_time, gap_end: curr.sample_time }),
            status: 'open',
          })
        }
      }
    }
  }

  return { anomalies, corrections }
}

router.get('/', (_req: Request, res: Response): void => {
  try {
    const runs = db.prepare('SELECT * FROM report_runs ORDER BY run_time DESC').all() as ReportRun[]
    res.json({ success: true, data: runs })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch runs' })
  }
})

router.post('/', (req: Request, res: Response): void => {
  try {
    const parameters = req.body.parameters || { bleaching_threshold: 3, coordinate_tolerance: 1.0, time_gap_hours: 48 }

    const runId = crypto.randomUUID()
    const snapshotId = crypto.randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO parameter_snapshots (id, run_id, parameters, changed_from, change_step, impact_summary)
      VALUES (?, NULL, ?, NULL, 0, NULL)
    `).run(snapshotId, JSON.stringify(parameters))

    db.prepare(`
      INSERT INTO report_runs (id, parameter_snapshot_id, status, total_records, anomaly_count)
      VALUES (?, ?, 'running', 0, 0)
    `).run(runId, snapshotId)

    db.prepare('UPDATE parameter_snapshots SET run_id = ? WHERE id = ?').run(runId, snapshotId)

    const records = db.prepare('SELECT * FROM survey_records').all() as SurveyRecord[]

    const { anomalies, corrections } = detectAnomalies(records, parameters)

    const insertAnomaly = db.prepare(`
      INSERT INTO anomaly_records (id, run_id, record_id, anomaly_type, severity, description, trace_chain, summary_mapping, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const insertCorrection = db.prepare(`
      INSERT INTO coordinate_corrections (id, anomaly_id, original_lat, original_lng, corrected_lat, corrected_lng)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    const anomalyIds: string[] = []

    const transaction = db.transaction(() => {
      for (const anomaly of anomalies) {
        const anomalyId = crypto.randomUUID()
        anomalyIds.push(anomalyId)
        insertAnomaly.run(
          anomalyId, runId, anomaly.record_id, anomaly.anomaly_type, anomaly.severity,
          anomaly.description, anomaly.trace_chain, anomaly.summary_mapping, anomaly.status
        )
      }

      for (const correction of corrections) {
        const anomalyId = anomalyIds[correction.anomaly_index]
        insertCorrection.run(
          crypto.randomUUID(), anomalyId,
          correction.original_lat, correction.original_lng,
          correction.corrected_lat, correction.corrected_lng
        )
      }

      db.prepare(`
        UPDATE report_runs SET status = 'completed', total_records = ?, anomaly_count = ? WHERE id = ?
      `).run(records.length, anomalies.length, runId)
    })

    transaction()

    const run = db.prepare('SELECT * FROM report_runs WHERE id = ?').get(runId) as ReportRun
    const runAnomalies = db.prepare('SELECT * FROM anomaly_records WHERE run_id = ?').all(runId) as AnomalyRecord[]
    const runCorrections = db.prepare(`
      SELECT cc.* FROM coordinate_corrections cc
      JOIN anomaly_records ar ON cc.anomaly_id = ar.id
      WHERE ar.run_id = ?
    `).all(runId)

    res.status(201).json({
      success: true,
      data: {
        ...run,
        anomalies: runAnomalies.map(a => ({
          ...a,
          trace_chain: JSON.parse(a.trace_chain),
          summary_mapping: JSON.parse(a.summary_mapping),
        })),
        coordinate_corrections: runCorrections,
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to execute run' })
  }
})

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const run = db.prepare('SELECT * FROM report_runs WHERE id = ?').get(id) as ReportRun | undefined

    if (!run) {
      res.status(404).json({ success: false, error: 'Run not found' })
      return
    }

    const anomalies = db.prepare('SELECT * FROM anomaly_records WHERE run_id = ?').all(id) as AnomalyRecord[]
    const corrections = db.prepare(`
      SELECT cc.* FROM coordinate_corrections cc
      JOIN anomaly_records ar ON cc.anomaly_id = ar.id
      WHERE ar.run_id = ?
    `).all(id)

    const snapshot = run.parameter_snapshot_id
      ? db.prepare('SELECT * FROM parameter_snapshots WHERE id = ?').get(run.parameter_snapshot_id) as ParameterSnapshot | undefined
      : null

    const byType: Record<string, number> = {}
    const bySeverity: Record<string, number> = {}
    const byStatus: Record<string, number> = {}

    for (const a of anomalies) {
      byType[a.anomaly_type] = (byType[a.anomaly_type] || 0) + 1
      bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1
      byStatus[a.status] = (byStatus[a.status] || 0) + 1
    }

    res.json({
      success: true,
      data: {
        ...run,
        snapshot: snapshot ? { ...snapshot, parameters: JSON.parse(snapshot.parameters), changed_from: snapshot.changed_from ? JSON.parse(snapshot.changed_from) : null, impact_summary: snapshot.impact_summary ? JSON.parse(snapshot.impact_summary) : null } : null,
        anomalies: anomalies.map(a => ({
          ...a,
          trace_chain: JSON.parse(a.trace_chain),
          summary_mapping: JSON.parse(a.summary_mapping),
        })),
        coordinate_corrections: corrections,
        summary_metrics: {
          total_records: run.total_records,
          anomaly_count: run.anomaly_count,
          by_type: byType,
          by_severity: bySeverity,
          by_status: byStatus,
        },
      },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch run' })
  }
})

export default router
