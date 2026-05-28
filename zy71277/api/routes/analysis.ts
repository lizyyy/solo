import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import db from '../db.js'
import type {
  DriftAnalysis,
  DriftResult,
  MatchedBeat,
  DriftPoint,
  SegmentStat,
  AnomalyRegion,
  AuditEntry,
  ErrorCause,
  AnalysisConfig,
} from '../../shared/types.js'

const router = Router()

function simulateDriftAnalysis(
  analysisId: string,
  audioId: string,
  config: AnalysisConfig
) {
  const beats = db
    .prepare(`SELECT * FROM beat_points WHERE audio_id = ? ORDER BY time_ms`)
    .all(audioId) as Record<string, unknown>[]

  const referenceInterval = 60000 / config.referenceBpm
  const durationRow = db
    .prepare(`SELECT duration FROM audio_files WHERE id = ?`)
    .get(audioId) as { duration: number }
  const durationMs = durationRow.duration * 1000

  const matchedBeats: MatchedBeat[] = []
  const driftCurve: DriftPoint[] = []
  const auditTrail: AuditEntry[] = []
  const anomalyRegions: AnomalyRegion[] = []

  let cumulativeDrift = 0
  const weakBeatIds: string[] = []
  const tempoChangePositions: number[] = []

  for (let i = 0; i < beats.length; i++) {
    const beat = beats[i]
    const detectedTime = beat.time_ms as number
    const confidence = beat.confidence as number
    const referenceTime = i * referenceInterval

    let offset = detectedTime - referenceTime

    if (i > beats.length * 0.6) {
      offset += (i - beats.length * 0.6) * 2.5
    } else if (i > beats.length * 0.3 && i < beats.length * 0.5) {
      offset += Math.sin(i * 0.3) * 15
    }

    if (i > beats.length * 0.7 && i < beats.length * 0.85) {
      offset += Math.random() * 20
      tempoChangePositions.push(detectedTime)
    }

    cumulativeDrift += offset
    const matched = Math.abs(offset) < config.driftThreshold

    matchedBeats.push({
      detectedTime,
      referenceTime,
      offset: Math.round(offset * 100) / 100,
      confidence,
      matched,
    })

    driftCurve.push({
      timeMs: detectedTime,
      driftMs: Math.round(offset * 100) / 100,
      cumulativeDriftMs: Math.round(cumulativeDrift * 100) / 100,
    })

    if (confidence < config.confidenceThreshold) {
      weakBeatIds.push(beat.id as string)
    }
  }

  const now = new Date().toISOString()

  auditTrail.push({
    step: 'threshold_check',
    formula: `driftThreshold = ${config.driftThreshold}ms`,
    inputs: { driftThreshold: config.driftThreshold },
    output: config.driftThreshold,
    timestamp: now,
  })

  auditTrail.push({
    step: 'confidence_filter',
    formula: `confidenceThreshold = ${config.confidenceThreshold}`,
    inputs: { confidenceThreshold: config.confidenceThreshold },
    output: beats.filter((b) => (b.confidence as number) < config.confidenceThreshold).length,
    timestamp: now,
  })

  const segments: SegmentStat[] = []
  const segmentSize = Math.max(Math.floor(beats.length / 4), 1)
  const segmentLabels = ['Intro', 'Verse A', 'Chorus', 'Outro']

  for (let s = 0; s < 4; s++) {
    const startIdx = s * segmentSize
    const endIdx = Math.min((s + 1) * segmentSize, beats.length)
    if (startIdx >= beats.length) break

    const segmentBeats = matchedBeats.slice(startIdx, endIdx)
    if (segmentBeats.length === 0) continue

    const drifts = segmentBeats.map((b) => b.offset)
    const sumDrift = Math.round(drifts.reduce((a, b) => a + b, 0) * 100) / 100
    const sumDriftSquared = Math.round(drifts.reduce((a, b) => a + b * b, 0) * 100) / 100
    const meanDrift = Math.round((sumDrift / drifts.length) * 100) / 100
    const variance = Math.round((sumDriftSquared / drifts.length - meanDrift * meanDrift) * 100) / 100
    const maxDrift = Math.round(Math.max(...drifts.map(Math.abs)) * 100) / 100

    const startMs = Math.round(beats[startIdx].time_ms as number * 100) / 100
    const endMs = Math.round(beats[endIdx - 1].time_ms as number * 100) / 100

    const formulaMean = `meanDrift = Σ(drift) / n = ${sumDrift} / ${drifts.length} = ${meanDrift}`
    const formulaVariance = `variance = Σ(drift²) / n - mean² = ${sumDriftSquared} / ${drifts.length} - ${meanDrift}² = ${variance}`

    segments.push({
      segmentId: `seg-${s + 1}`,
      label: segmentLabels[s] || `Segment ${s + 1}`,
      startMs,
      endMs,
      meanDrift,
      variance,
      maxDrift,
      beatCount: drifts.length,
      calculationDetail: {
        sumDrift,
        sumDriftSquared,
        formulaMean,
        formulaVariance,
      },
    })

    auditTrail.push({
      step: 'segment_calculation',
      formula: formulaMean,
      inputs: { sumDrift, n: drifts.length },
      output: meanDrift,
      timestamp: now,
    })
  }

  let anomalyId = 0
  for (let i = 1; i < driftCurve.length; i++) {
    const prev = driftCurve[i - 1]
    const curr = driftCurve[i]
    if (Math.abs(curr.driftMs) > config.driftThreshold) {
      const severity =
        Math.abs(curr.driftMs) > config.driftThreshold * 2
          ? 'high'
          : Math.abs(curr.driftMs) > config.driftThreshold * 1.3
            ? 'medium'
            : 'low'

      let startMs = prev.timeMs
      let endMs = curr.timeMs

      const overlap = anomalyRegions.find(
        (r) => Math.abs(r.endMs - startMs) < referenceInterval * 2
      )
      if (overlap) {
        overlap.endMs = endMs
        overlap.driftAtEnd = curr.driftMs
        if (severity === 'high') overlap.severity = 'high'
        else if (severity === 'medium' && overlap.severity !== 'high')
          overlap.severity = 'medium'
      } else {
        anomalyId++
        anomalyRegions.push({
          id: `anomaly-${anomalyId}`,
          startMs,
          endMs,
          severity,
          driftAtStart: prev.driftMs,
          driftAtEnd: curr.driftMs,
          tag: severity === 'high' ? 'major_drift' : 'minor_drift',
        })
      }

      auditTrail.push({
        step: 'anomaly_detection',
        formula: `|drift| > threshold → ${Math.abs(curr.driftMs)} > ${config.driftThreshold}`,
        inputs: { drift: curr.driftMs, threshold: config.driftThreshold },
        output: Math.abs(curr.driftMs),
        timestamp: now,
      })
    }
  }

  const resultId = uuidv4()
  db.prepare(
    `INSERT INTO drift_results (id, analysis_id, matched_beats, drift_curve, segments, anomaly_regions, audit_trail) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(
    resultId,
    analysisId,
    JSON.stringify(matchedBeats),
    JSON.stringify(driftCurve),
    JSON.stringify(segments),
    JSON.stringify(anomalyRegions),
    JSON.stringify(auditTrail)
  )

  if (weakBeatIds.length > 0) {
    const firstWeak = beats.find((b) => weakBeatIds.includes(b.id as string))
    if (firstWeak) {
      const errorId = uuidv4()
      db.prepare(
        `INSERT INTO error_causes (id, analysis_id, type, time_ms_start, time_ms_end, reason, impact_score, impact_range, affected_beat_ids, next_action, next_action_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        errorId,
        analysisId,
        'weak_beat',
        firstWeak.time_ms as number,
        (firstWeak.time_ms as number) + referenceInterval,
        `Detected ${weakBeatIds.length} beats with confidence below ${config.confidenceThreshold}`,
        Math.round((0.3 + Math.random() * 0.4) * 100) / 100,
        `±${Math.round(referenceInterval * 0.1)}ms`,
        JSON.stringify(weakBeatIds),
        'manual_correct',
        'Low confidence beats need manual verification and correction'
      )
    }
  }

  if (tempoChangePositions.length > 0) {
    const errorId = uuidv4()
    const startMs = tempoChangePositions[0]
    const endMs = tempoChangePositions[tempoChangePositions.length - 1]
    db.prepare(
      `INSERT INTO error_causes (id, analysis_id, type, time_ms_start, time_ms_end, reason, impact_score, impact_range, affected_beat_ids, next_action, next_action_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      errorId,
      analysisId,
      'tempo_change',
      startMs,
      endMs,
      `Detected tempo variation in region ${Math.round(startMs)}ms-${Math.round(endMs)}ms`,
      Math.round((0.5 + Math.random() * 0.3) * 100) / 100,
      `±${Math.round(referenceInterval * 0.15)}ms`,
      '[]',
      'redetect',
      'Tempo changes require re-detection with adjusted parameters'
    )
  }

  if (beats.length > 20 && Math.random() > 0.5) {
    const errorId = uuidv4()
    const maskStart = beats[Math.floor(beats.length * 0.4)].time_ms as number
    const maskEnd = beats[Math.floor(beats.length * 0.5)].time_ms as number
    db.prepare(
      `INSERT INTO error_causes (id, analysis_id, type, time_ms_start, time_ms_end, reason, impact_score, impact_range, affected_beat_ids, next_action, next_action_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      errorId,
      analysisId,
      'voice_masking',
      maskStart,
      maskEnd,
      'Potential voice masking detected causing beat detection interference',
      Math.round((0.4 + Math.random() * 0.3) * 100) / 100,
      `±${Math.round(referenceInterval * 0.12)}ms`,
      '[]',
      'ignore',
      'Voice masking is minor and within acceptable range'
    )
  }

  db.prepare(`UPDATE drift_analyses SET status = ? WHERE id = ?`).run(
    'completed',
    analysisId
  )
}

router.post('/', (req: Request, res: Response): void => {
  const { audioId, voicePart, referenceBpm, driftThreshold, minSegmentLength, confidenceThreshold } =
    req.body

  if (!audioId || !referenceBpm) {
    res
      .status(400)
      .json({ success: false, error: 'audioId and referenceBpm are required' })
    return
  }

  const audio = db
    .prepare(`SELECT id FROM audio_files WHERE id = ?`)
    .get(audioId)
  if (!audio) {
    res.status(404).json({ success: false, error: 'Audio file not found' })
    return
  }

  const id = uuidv4()
  const createdAt = new Date().toISOString()

  db.prepare(
    `INSERT INTO drift_analyses (id, audio_id, voice_part, created_at, status, reference_bpm, drift_threshold, min_segment_length, confidence_threshold) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    audioId,
    voicePart || 'default',
    createdAt,
    'pending',
    referenceBpm,
    driftThreshold ?? 50.0,
    minSegmentLength ?? 4.0,
    confidenceThreshold ?? 0.6
  )

  const config: AnalysisConfig = {
    referenceBpm,
    driftThreshold: driftThreshold ?? 50.0,
    minSegmentLength: minSegmentLength ?? 4.0,
    confidenceThreshold: confidenceThreshold ?? 0.6,
  }

  simulateDriftAnalysis(id, audioId, config)

  const row = db
    .prepare(`SELECT * FROM drift_analyses WHERE id = ?`)
    .get(id) as Record<string, unknown>

  const analysis: DriftAnalysis = {
    id: row.id as string,
    audioId: row.audio_id as string,
    voicePart: row.voice_part as string,
    createdAt: row.created_at as string,
    status: row.status as DriftAnalysis['status'],
    config,
  }

  res.status(201).json({ success: true, data: analysis })
})

router.get('/:id', (req: Request, res: Response): void => {
  const { id } = req.params
  const row = db
    .prepare(`SELECT * FROM drift_analyses WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined

  if (!row) {
    res.status(404).json({ success: false, error: 'Analysis not found' })
    return
  }

  const analysis: DriftAnalysis = {
    id: row.id as string,
    audioId: row.audio_id as string,
    voicePart: row.voice_part as string,
    createdAt: row.created_at as string,
    status: row.status as DriftAnalysis['status'],
    config: {
      referenceBpm: row.reference_bpm as number,
      driftThreshold: row.drift_threshold as number,
      minSegmentLength: row.min_segment_length as number,
      confidenceThreshold: row.confidence_threshold as number,
    },
  }

  res.json({ success: true, data: analysis })
})

router.get('/:id/result', (req: Request, res: Response): void => {
  const { id } = req.params
  const row = db
    .prepare(`SELECT * FROM drift_results WHERE analysis_id = ?`)
    .get(id) as Record<string, unknown> | undefined

  if (!row) {
    res.status(404).json({ success: false, error: 'Result not found' })
    return
  }

  const result: DriftResult = {
    matchedBeats: JSON.parse(row.matched_beats as string),
    driftCurve: JSON.parse(row.drift_curve as string),
    segments: JSON.parse(row.segments as string),
    anomalyRegions: JSON.parse(row.anomaly_regions as string),
    auditTrail: JSON.parse(row.audit_trail as string),
  }

  res.json({ success: true, data: result })
})

export default router
