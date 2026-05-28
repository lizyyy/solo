import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import type {
  DriftReport,
  DriftResult,
  ErrorCause,
  ClassNote,
  SegmentStat,
  AnomalyRegion,
  AuditEntry,
} from '../../shared/types.js'

const router = Router()

function rowToReport(row: Record<string, unknown>): DriftReport {
  return {
    id: row.id as string,
    analysisId: row.analysis_id as string,
    createdAt: row.created_at as string,
    submissionType: row.submission_type as DriftReport['submissionType'],
    status: row.status as DriftReport['status'],
    supplementaryReason: (row.supplementary_reason as string) ?? undefined,
    withdrawnReason: (row.withdrawn_reason as string) ?? undefined,
    duplicateOf: (row.duplicate_of as string) ?? undefined,
  }
}

router.post('/', (req: Request, res: Response): void => {
  const { analysisId } = req.body
  if (!analysisId) {
    res
      .status(400)
      .json({ success: false, error: 'analysisId is required' })
    return
  }

  const analysis = db
    .prepare(`SELECT id FROM drift_analyses WHERE id = ?`)
    .get(analysisId)
  if (!analysis) {
    res.status(404).json({ success: false, error: 'Analysis not found' })
    return
  }

  const id = uuidv4()
  const createdAt = new Date().toISOString()

  db.prepare(
    `INSERT INTO drift_reports (id, analysis_id, created_at, submission_type, status) VALUES (?, ?, ?, ?, ?)`
  ).run(id, analysisId, createdAt, 'normal', 'draft')

  const row = db
    .prepare(`SELECT * FROM drift_reports WHERE id = ?`)
    .get(id) as Record<string, unknown>

  res.status(201).json({ success: true, data: rowToReport(row) })
})

router.get('/', (_req: Request, res: Response): void => {
  const rows = db
    .prepare(`SELECT * FROM drift_reports ORDER BY created_at DESC`)
    .all() as Record<string, unknown>[]

  const reports = rows.map(rowToReport)
  res.json({ success: true, data: reports })
})

router.get('/:id', (req: Request, res: Response): void => {
  const { id } = req.params
  const row = db
    .prepare(`SELECT * FROM drift_reports WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined

  if (!row) {
    res.status(404).json({ success: false, error: 'Report not found' })
    return
  }

  const report = rowToReport(row)

  const resultRow = db
    .prepare(`SELECT * FROM drift_results WHERE analysis_id = ?`)
    .get(report.analysisId) as Record<string, unknown> | undefined

  let result: DriftResult | null = null
  if (resultRow) {
    result = {
      matchedBeats: JSON.parse(resultRow.matched_beats as string),
      driftCurve: JSON.parse(resultRow.drift_curve as string),
      segments: JSON.parse(resultRow.segments as string),
      anomalyRegions: JSON.parse(resultRow.anomaly_regions as string),
      auditTrail: JSON.parse(resultRow.audit_trail as string),
    }
  }

  const errorRows = db
    .prepare(`SELECT * FROM error_causes WHERE analysis_id = ?`)
    .all(report.analysisId) as Record<string, unknown>[]
  const errors: ErrorCause[] = errorRows.map((e) => ({
    id: e.id as string,
    analysisId: e.analysis_id as string,
    type: e.type as ErrorCause['type'],
    timeMsStart: e.time_ms_start as number,
    timeMsEnd: e.time_ms_end as number,
    reason: e.reason as string,
    impactScore: e.impact_score as number,
    impactRange: e.impact_range as string,
    affectedBeatIds: JSON.parse(e.affected_beat_ids as string),
    nextAction: e.next_action as ErrorCause['nextAction'],
    nextActionReason: e.next_action_reason as string,
    resolvedAt: (e.resolved_at as string) ?? undefined,
    resolvedBy: (e.resolved_by as string) ?? undefined,
    resolution: (e.resolution as string) ?? undefined,
  }))

  const analysisRow = db
    .prepare(`SELECT audio_id FROM drift_analyses WHERE id = ?`)
    .get(report.analysisId) as { audio_id: string } | undefined
  let notes: ClassNote[] = []
  if (analysisRow) {
    const noteRows = db
      .prepare(`SELECT * FROM class_notes WHERE audio_id = ?`)
      .all(analysisRow.audio_id) as Record<string, unknown>[]
    notes = noteRows.map((n) => ({
      id: n.id as string,
      audioId: n.audio_id as string,
      timeMsStart: n.time_ms_start as number,
      timeMsEnd: n.time_ms_end as number,
      content: n.content as string,
      screenshotUrl: (n.screenshot_url as string) ?? undefined,
      type: n.type as ClassNote['type'],
    }))
  }

  res.json({
    success: true,
    data: { report, result, errors, notes },
  })
})

router.put('/:id/submit', (req: Request, res: Response): void => {
  const { id } = req.params
  const row = db
    .prepare(`SELECT * FROM drift_reports WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined
  if (!row) {
    res.status(404).json({ success: false, error: 'Report not found' })
    return
  }

  db.prepare(`UPDATE drift_reports SET status = ? WHERE id = ?`).run(
    'submitted',
    id
  )

  const updated = db
    .prepare(`SELECT * FROM drift_reports WHERE id = ?`)
    .get(id) as Record<string, unknown>
  res.json({ success: true, data: rowToReport(updated) })
})

router.put('/:id/withdraw', (req: Request, res: Response): void => {
  const { id } = req.params
  const { reason } = req.body

  if (!reason) {
    res
      .status(400)
      .json({ success: false, error: 'reason is required' })
    return
  }

  const row = db
    .prepare(`SELECT * FROM drift_reports WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined
  if (!row) {
    res.status(404).json({ success: false, error: 'Report not found' })
    return
  }

  db.prepare(
    `UPDATE drift_reports SET status = ?, withdrawn_reason = ? WHERE id = ?`
  ).run('withdrawn', reason, id)

  const updated = db
    .prepare(`SELECT * FROM drift_reports WHERE id = ?`)
    .get(id) as Record<string, unknown>
  res.json({ success: true, data: rowToReport(updated) })
})

router.put('/:id/supplement', (req: Request, res: Response): void => {
  const { id } = req.params
  const { reason } = req.body

  if (!reason) {
    res
      .status(400)
      .json({ success: false, error: 'reason is required' })
    return
  }

  const row = db
    .prepare(`SELECT * FROM drift_reports WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined
  if (!row) {
    res.status(404).json({ success: false, error: 'Report not found' })
    return
  }

  db.prepare(
    `UPDATE drift_reports SET status = ?, supplementary_reason = ? WHERE id = ?`
  ).run('supplementary', reason, id)

  const updated = db
    .prepare(`SELECT * FROM drift_reports WHERE id = ?`)
    .get(id) as Record<string, unknown>
  res.json({ success: true, data: rowToReport(updated) })
})

router.post('/:id/duplicate-check', (req: Request, res: Response): void => {
  const { id } = req.params
  const row = db
    .prepare(`SELECT * FROM drift_reports WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined
  if (!row) {
    res.status(404).json({ success: false, error: 'Report not found' })
    return
  }

  const analysisId = row.analysis_id as string
  const duplicate = db
    .prepare(
      `SELECT * FROM drift_reports WHERE analysis_id = ? AND id != ? AND status != 'withdrawn' LIMIT 1`
    )
    .get(analysisId, id) as Record<string, unknown> | undefined

  if (duplicate) {
    db.prepare(
      `UPDATE drift_reports SET status = ?, submission_type = ?, duplicate_of = ? WHERE id = ?`
    ).run('duplicate', 'duplicate', duplicate.id as string, id)

    const updated = db
      .prepare(`SELECT * FROM drift_reports WHERE id = ?`)
      .get(id) as Record<string, unknown>
    res.json({
      success: true,
      data: { isDuplicate: true, duplicateOf: rowToReport(duplicate), report: rowToReport(updated) },
    })
  } else {
    res.json({ success: true, data: { isDuplicate: false } })
  }
})

router.get('/:id/export', (req: Request, res: Response): void => {
  const { id } = req.params
  const row = db
    .prepare(`SELECT * FROM drift_reports WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined
  if (!row) {
    res.status(404).json({ success: false, error: 'Report not found' })
    return
  }

  const analysisId = row.analysis_id as string
  const resultRow = db
    .prepare(`SELECT * FROM drift_results WHERE analysis_id = ?`)
    .get(analysisId) as Record<string, unknown> | undefined
  const errorRows = db
    .prepare(`SELECT * FROM error_causes WHERE analysis_id = ?`)
    .all(analysisId) as Record<string, unknown>[]

  const segments: SegmentStat[] = resultRow
    ? JSON.parse(resultRow.segments as string)
    : []
  const anomalyRegions: AnomalyRegion[] = resultRow
    ? JSON.parse(resultRow.anomaly_regions as string)
    : []
  const auditTrail: AuditEntry[] = resultRow
    ? JSON.parse(resultRow.audit_trail as string)
    : []

  const lines: string[] = []
  lines.push('Beat Drift Estimator - Export Report')
  lines.push(`Report ID,${id}`)
  lines.push(`Analysis ID,${analysisId}`)
  lines.push(`Created At,${row.created_at}`)
  lines.push(`Status,${row.status}`)
  lines.push('')

  lines.push('=== SEGMENTS ===')
  lines.push(
    'SegmentID,Label,StartMs,EndMs,MeanDrift,Variance,MaxDrift,BeatCount'
  )
  for (const seg of segments) {
    lines.push(
      `${seg.segmentId},${seg.label},${seg.startMs},${seg.endMs},${seg.meanDrift},${seg.variance},${seg.maxDrift},${seg.beatCount}`
    )
  }
  lines.push('')

  lines.push('=== ANOMALY REGIONS ===')
  lines.push('ID,StartMs,EndMs,Severity,DriftAtStart,DriftAtEnd,Tag')
  for (const a of anomalyRegions) {
    lines.push(
      `${a.id},${a.startMs},${a.endMs},${a.severity},${a.driftAtStart},${a.driftAtEnd},${a.tag}`
    )
  }
  lines.push('')

  lines.push('=== ERROR CAUSES ===')
  lines.push(
    'ID,Type,StartMs,EndMs,Reason,ImpactScore,NextAction'
  )
  for (const e of errorRows) {
    lines.push(
      `${e.id},${e.type},${e.time_ms_start},${e.time_ms_end},"${e.reason}",${e.impact_score},${e.next_action}`
    )
  }
  lines.push('')

  lines.push('=== AUDIT TRAIL ===')
  lines.push('Step,Formula,Output,Timestamp')
  for (const a of auditTrail) {
    lines.push(`${a.step},"${a.formula}",${a.output},${a.timestamp}`)
  }

  const csv = lines.join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename=report-${id}.csv`
  )
  res.send(csv)
})

export default router
