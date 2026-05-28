import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import db from '../db.js'
import type {
  AudioFile,
  BeatPoint,
  TempoMark,
  ClassNote,
  DriftAnalysis,
} from '../../shared/types.js'

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, path.join(process.cwd(), 'uploads'))
  },
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}-${file.originalname}`)
  },
})

const upload = multer({ storage })

const router = Router()

router.post(
  '/upload',
  upload.single('audio'),
  (req: Request, res: Response): void => {
    const file = req.file
    if (!file) {
      res.status(400).json({ success: false, error: 'No file uploaded' })
      return
    }

    const id = uuidv4()
    const duration = 20 + Math.random() * 80
    const sampleRate = 44100
    const channels = 1
    const uploadedAt = new Date().toISOString()

    db.prepare(
      `INSERT INTO audio_files (id, filename, duration, sample_rate, channels, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, file.originalname, duration, sampleRate, channels, uploadedAt)

    const defaultBpm = 120
    const intervalMs = 60000 / defaultBpm
    const beatCount = Math.floor((duration * 1000) / intervalMs)
    const actualBeatCount = Math.min(
      Math.max(20, Math.floor(beatCount * (0.7 + Math.random() * 0.3))),
      60
    )

    const beatPoints: BeatPoint[] = []
    const insertBeat = db.prepare(
      `INSERT INTO beat_points (id, audio_id, voice_part, time_ms, confidence, is_manual, corrected_from) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )

    for (let i = 0; i < actualBeatCount; i++) {
      const jitter = (Math.random() - 0.5) * 30
      const timeMs = Math.round((i * intervalMs + jitter) * 100) / 100
      const isWeak = Math.random() < 0.15
      const confidence = isWeak
        ? Math.round((0.3 + Math.random() * 0.29) * 100) / 100
        : Math.round((0.6 + Math.random() * 0.4) * 100) / 100

      const beatId = uuidv4()
      insertBeat.run(beatId, id, 'default', timeMs, confidence, 0, null)
      beatPoints.push({
        id: beatId,
        audioId: id,
        voicePart: 'default',
        timeMs,
        confidence,
        isManual: false,
      })
    }

    const tempoMarkId = uuidv4()
    db.prepare(
      `INSERT INTO tempo_marks (id, audio_id, time_ms, bpm, type, label) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(tempoMarkId, id, 0, defaultBpm, 'stable', 'Initial tempo')

    const audioFile: AudioFile = {
      id,
      filename: file.originalname,
      duration,
      sampleRate,
      channels,
      uploadedAt,
    }

    res.status(201).json({
      success: true,
      data: {
        audioFile,
        beatPoints,
        tempoMarks: [
          {
            id: tempoMarkId,
            audioId: id,
            timeMs: 0,
            bpm: defaultBpm,
            type: 'stable',
            label: 'Initial tempo',
          },
        ],
      },
    })
  }
)

router.get(
  '/:id/waveform',
  (req: Request, res: Response): void => {
    const { id } = req.params
    const row = db
      .prepare(`SELECT duration FROM audio_files WHERE id = ?`)
      .get(id) as { duration: number } | undefined

    if (!row) {
      res.status(404).json({ success: false, error: 'Audio file not found' })
      return
    }

    const points = 1000
    const waveform: number[] = []
    for (let i = 0; i < points; i++) {
      const t = i / points
      const base = Math.sin(t * Math.PI * 20) * 0.5
      const noise = (Math.random() - 0.5) * 0.3
      const envelope = Math.sin(t * Math.PI) * 0.8
      waveform.push(Math.round((base * envelope + noise) * 1000) / 1000)
    }

    res.json({ success: true, data: waveform })
  }
)

router.post(
  '/beat-points',
  (req: Request, res: Response): void => {
    const { audioId, voicePart, timeMs, confidence, correctedFrom } = req.body
    if (!audioId || timeMs === undefined) {
      res
        .status(400)
        .json({ success: false, error: 'audioId and timeMs are required' })
      return
    }

    const id = uuidv4()
    db.prepare(
      `INSERT INTO beat_points (id, audio_id, voice_part, time_ms, confidence, is_manual, corrected_from) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      audioId,
      voicePart || 'default',
      timeMs,
      confidence ?? 1.0,
      1,
      correctedFrom ?? null
    )

    const beatPoint: BeatPoint = {
      id,
      audioId,
      voicePart: voicePart || 'default',
      timeMs,
      confidence: confidence ?? 1.0,
      isManual: true,
      correctedFrom: correctedFrom ?? undefined,
    }

    res.status(201).json({ success: true, data: beatPoint })
  }
)

router.put(
  '/beat-points/:id',
  (req: Request, res: Response): void => {
    const { id } = req.params
    const { timeMs, confidence, isManual, correctedFrom } = req.body

    const existing = db
      .prepare(`SELECT * FROM beat_points WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined
    if (!existing) {
      res
        .status(404)
        .json({ success: false, error: 'Beat point not found' })
      return
    }

    db.prepare(
      `UPDATE beat_points SET time_ms = ?, confidence = ?, is_manual = ?, corrected_from = ? WHERE id = ?`
    ).run(
      timeMs ?? existing.time_ms,
      confidence ?? existing.confidence,
      isManual !== undefined ? (isManual ? 1 : 0) : existing.is_manual,
      correctedFrom !== undefined ? correctedFrom : existing.corrected_from,
      id
    )

    const row = db
      .prepare(`SELECT * FROM beat_points WHERE id = ?`)
      .get(id) as Record<string, unknown>

    const beatPoint: BeatPoint = {
      id: row.id as string,
      audioId: row.audio_id as string,
      voicePart: row.voice_part as string,
      timeMs: row.time_ms as number,
      confidence: row.confidence as number,
      isManual: (row.is_manual as number) === 1,
      correctedFrom: (row.corrected_from as number) ?? undefined,
    }

    res.json({ success: true, data: beatPoint })
  }
)

router.delete(
  '/beat-points/:id',
  (req: Request, res: Response): void => {
    const { id } = req.params
    const result = db.prepare(`DELETE FROM beat_points WHERE id = ?`).run(id)
    if (result.changes === 0) {
      res
        .status(404)
        .json({ success: false, error: 'Beat point not found' })
      return
    }
    res.json({ success: true })
  }
)

router.post(
  '/tempo-marks',
  (req: Request, res: Response): void => {
    const { audioId, timeMs, bpm, type, label } = req.body
    if (!audioId || timeMs === undefined || bpm === undefined) {
      res
        .status(400)
        .json({ success: false, error: 'audioId, timeMs and bpm are required' })
      return
    }

    const id = uuidv4()
    db.prepare(
      `INSERT INTO tempo_marks (id, audio_id, time_ms, bpm, type, label) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, audioId, timeMs, bpm, type || 'stable', label || '')

    const tempoMark: TempoMark = {
      id,
      audioId,
      timeMs,
      bpm,
      type: type || 'stable',
      label: label || '',
    }

    res.status(201).json({ success: true, data: tempoMark })
  }
)

router.put(
  '/tempo-marks/:id',
  (req: Request, res: Response): void => {
    const { id } = req.params
    const { timeMs, bpm, type, label } = req.body

    const existing = db
      .prepare(`SELECT * FROM tempo_marks WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined
    if (!existing) {
      res.status(404).json({ success: false, error: 'Tempo mark not found' })
      return
    }

    db.prepare(
      `UPDATE tempo_marks SET time_ms = ?, bpm = ?, type = ?, label = ? WHERE id = ?`
    ).run(
      timeMs ?? existing.time_ms,
      bpm ?? existing.bpm,
      type ?? existing.type,
      label ?? existing.label,
      id
    )

    const row = db
      .prepare(`SELECT * FROM tempo_marks WHERE id = ?`)
      .get(id) as Record<string, unknown>

    const tempoMark: TempoMark = {
      id: row.id as string,
      audioId: row.audio_id as string,
      timeMs: row.time_ms as number,
      bpm: row.bpm as number,
      type: row.type as TempoMark['type'],
      label: row.label as string,
    }

    res.json({ success: true, data: tempoMark })
  }
)

router.delete(
  '/tempo-marks/:id',
  (req: Request, res: Response): void => {
    const { id } = req.params
    const result = db.prepare(`DELETE FROM tempo_marks WHERE id = ?`).run(id)
    if (result.changes === 0) {
      res.status(404).json({ success: false, error: 'Tempo mark not found' })
      return
    }
    res.json({ success: true })
  }
)

router.post(
  '/class-notes',
  (req: Request, res: Response): void => {
    const { audioId, timeMsStart, timeMsEnd, content, screenshotUrl, type } =
      req.body
    if (!audioId || timeMsStart === undefined || timeMsEnd === undefined || !content) {
      res
        .status(400)
        .json({
          success: false,
          error: 'audioId, timeMsStart, timeMsEnd and content are required',
        })
      return
    }

    const id = uuidv4()
    db.prepare(
      `INSERT INTO class_notes (id, audio_id, time_ms_start, time_ms_end, content, screenshot_url, type) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      audioId,
      timeMsStart,
      timeMsEnd,
      content,
      screenshotUrl ?? null,
      type || 'text'
    )

    const classNote: ClassNote = {
      id,
      audioId,
      timeMsStart,
      timeMsEnd,
      content,
      screenshotUrl: screenshotUrl ?? undefined,
      type: type || 'text',
    }

    res.status(201).json({ success: true, data: classNote })
  }
)

router.put(
  '/class-notes/:id',
  (req: Request, res: Response): void => {
    const { id } = req.params
    const { timeMsStart, timeMsEnd, content, screenshotUrl, type } = req.body

    const existing = db
      .prepare(`SELECT * FROM class_notes WHERE id = ?`)
      .get(id) as Record<string, unknown> | undefined
    if (!existing) {
      res.status(404).json({ success: false, error: 'Class note not found' })
      return
    }

    db.prepare(
      `UPDATE class_notes SET time_ms_start = ?, time_ms_end = ?, content = ?, screenshot_url = ?, type = ? WHERE id = ?`
    ).run(
      timeMsStart ?? existing.time_ms_start,
      timeMsEnd ?? existing.time_ms_end,
      content ?? existing.content,
      screenshotUrl !== undefined ? screenshotUrl : existing.screenshot_url,
      type ?? existing.type,
      id
    )

    const row = db
      .prepare(`SELECT * FROM class_notes WHERE id = ?`)
      .get(id) as Record<string, unknown>

    const classNote: ClassNote = {
      id: row.id as string,
      audioId: row.audio_id as string,
      timeMsStart: row.time_ms_start as number,
      timeMsEnd: row.time_ms_end as number,
      content: row.content as string,
      screenshotUrl: (row.screenshot_url as string) ?? undefined,
      type: row.type as ClassNote['type'],
    }

    res.json({ success: true, data: classNote })
  }
)

router.get(
  '/:id/analyses',
  (req: Request, res: Response): void => {
    const { id: audioId } = req.params
    const rows = db
      .prepare(`SELECT * FROM drift_analyses WHERE audio_id = ? ORDER BY created_at DESC`)
      .all(audioId) as Record<string, unknown>[]

    const analyses: DriftAnalysis[] = rows.map((row) => ({
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
    }))

    res.json({ success: true, data: analyses })
  }
)

router.delete(
  '/class-notes/:id',
  (req: Request, res: Response): void => {
    const { id } = req.params
    const result = db.prepare(`DELETE FROM class_notes WHERE id = ?`).run(id)
    if (result.changes === 0) {
      res.status(404).json({ success: false, error: 'Class note not found' })
      return
    }
    res.json({ success: true })
  }
)

export default router
