import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db.js'
import { detectBPM } from '../services/bpmDetector.js'

const router = Router()

router.post('/upload', (req: Request, res: Response): void => {
  try {
    const { fileName, samples, sampleRate } = req.body

    if (!fileName || !samples || !sampleRate) {
      res.status(400).json({ success: false, error: 'fileName, samples, and sampleRate are required' })
      return
    }

    if (!Array.isArray(samples)) {
      res.status(400).json({ success: false, error: 'samples must be an array' })
      return
    }

    const id = uuidv4()
    const duration = samples.length / sampleRate
    const { bpm, confidence: bpmConfidence } = detectBPM(samples, sampleRate)

    const db = getDb()
    db.prepare(
      `INSERT INTO audio_files (id, file_name, duration, sample_rate, bpm, bpm_confidence) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, fileName, duration, sampleRate, bpm, bpmConfidence)

    db.prepare(
      `INSERT INTO audio_samples (file_id, data) VALUES (?, ?)`
    ).run(id, JSON.stringify(samples))

    const waveform: number[] = []
    const targetPoints = 2000
    const step = Math.max(1, Math.floor(samples.length / targetPoints))
    for (let i = 0; i < samples.length; i += step) {
      waveform.push(samples[i])
    }

    res.status(200).json({
      success: true,
      data: {
        fileId: id,
        fileName,
        duration,
        sampleRate,
        bpm,
        bpmConfidence,
        waveform
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to upload audio file' })
  }
})

export default router
