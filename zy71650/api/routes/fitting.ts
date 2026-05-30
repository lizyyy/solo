import { Router, type Request, type Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { getDb } from '../db.js'
import { fitADSR } from '../services/adsrFitter.js'
import { detectAnomalies } from '../services/anomalyDetector.js'

const router = Router()

router.post('/fit', (req: Request, res: Response): void => {
  try {
    const { fileId, onsetSample, instrumentLabel, notes } = req.body

    if (!fileId || onsetSample === undefined) {
      res.status(400).json({ success: false, error: 'fileId and onsetSample are required' })
      return
    }

    const db = getDb()

    const audioFile = db.prepare('SELECT * FROM audio_files WHERE id = ?').get(fileId) as any
    if (!audioFile) {
      res.status(404).json({ success: false, error: 'Audio file not found' })
      return
    }

    const samplesRow = db.prepare('SELECT * FROM audio_samples WHERE file_id = ?').get(fileId) as any

    let samples: number[]
    if (samplesRow) {
      samples = JSON.parse(samplesRow.data)
    } else {
      res.status(400).json({ success: false, error: 'Audio samples not found for this file' })
      return
    }

    const sampleRate = audioFile.sample_rate
    const { raw, peakInfo } = fitADSR(samples, sampleRate, onsetSample)
    const anomalies = detectAnomalies(raw, peakInfo)

    const recordId = uuidv4()
    const conclusion = { ...raw }

    db.prepare(
      `INSERT INTO fitting_records (id, file_id, instrument_label, raw_attack, raw_decay, raw_sustain, raw_release, conclusion_attack, conclusion_decay, conclusion_sustain, conclusion_release) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(recordId, fileId, instrumentLabel || '', raw.attack, raw.decay, raw.sustain, raw.release, conclusion.attack, conclusion.decay, conclusion.sustain, conclusion.release)

    for (const anomaly of anomalies) {
      const anomalyId = uuidv4()
      db.prepare(
        `INSERT INTO anomaly_flags (id, record_id, type, description, severity, affected_param) VALUES (?, ?, ?, ?, ?, ?)`
      ).run(anomalyId, recordId, anomaly.type, anomaly.description, anomaly.severity, anomaly.affected_param)
    }

    const fitJudgment = `Fitted ADSR: attack=${raw.attack.toFixed(4)}s, decay=${raw.decay.toFixed(4)}s, sustain=${raw.sustain.toFixed(4)}, release=${raw.release.toFixed(4)}s`
    const peakJudgment = `Peak at sample ${peakInfo.peakSample}, amplitude ${peakInfo.peakAmplitude.toFixed(4)}`
    const interpretJudgment = `Conclusion: attack=${conclusion.attack.toFixed(4)}s, decay=${conclusion.decay.toFixed(4)}s, sustain=${conclusion.sustain.toFixed(4)}, release=${conclusion.release.toFixed(4)}s, anomalies=${anomalies.length}`

    db.prepare(
      `INSERT INTO audit_entries (id, record_id, operation_type, judgment) VALUES (?, ?, ?, ?)`
    ).run(uuidv4(), recordId, 'fit', fitJudgment)

    db.prepare(
      `INSERT INTO audit_entries (id, record_id, operation_type, judgment) VALUES (?, ?, ?, ?)`
    ).run(uuidv4(), recordId, 'peak_detect', peakJudgment)

    db.prepare(
      `INSERT INTO audit_entries (id, record_id, operation_type, judgment) VALUES (?, ?, ?, ?)`
    ).run(uuidv4(), recordId, 'param_interpret', interpretJudgment)

    const noteContent = notes || ''
    db.prepare(
      `INSERT INTO note_versions (id, record_id, content, version) VALUES (?, ?, ?, ?)`
    ).run(uuidv4(), recordId, noteContent, 1)

    const record = db.prepare('SELECT * FROM fitting_records WHERE id = ?').get(recordId) as any
    const recordAnomalies = db.prepare('SELECT * FROM anomaly_flags WHERE record_id = ?').all(recordId) as any[]
    const recordNotes = db.prepare('SELECT * FROM note_versions WHERE record_id = ?').all(recordId) as any[]

    res.status(200).json({
      success: true,
      data: {
        ...record,
        anomalies: recordAnomalies,
        notes: recordNotes,
        peakInfo
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fit ADSR envelope' })
  }
})

router.put('/:id/corrected', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { corrected, judgment } = req.body

    if (!corrected || !judgment) {
      res.status(400).json({ success: false, error: 'corrected params and judgment are required' })
      return
    }

    const db = getDb()

    const record = db.prepare('SELECT * FROM fitting_records WHERE id = ?').get(id) as any
    if (!record) {
      res.status(404).json({ success: false, error: 'Fitting record not found' })
      return
    }

    const conclusionAttack = corrected.attack ?? record.raw_attack
    const conclusionDecay = corrected.decay ?? record.raw_decay
    const conclusionSustain = corrected.sustain ?? record.raw_sustain
    const conclusionRelease = corrected.release ?? record.raw_release

    db.prepare(
      `UPDATE fitting_records SET corrected_attack = ?, corrected_decay = ?, corrected_sustain = ?, corrected_release = ?, conclusion_attack = ?, conclusion_decay = ?, conclusion_sustain = ?, conclusion_release = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(corrected.attack, corrected.decay, corrected.sustain, corrected.release, conclusionAttack, conclusionDecay, conclusionSustain, conclusionRelease, id)

    db.prepare(
      `INSERT INTO audit_entries (id, record_id, operation_type, judgment) VALUES (?, ?, ?, ?)`
    ).run(uuidv4(), id, 'param_interpret', judgment)

    const updatedRecord = db.prepare('SELECT * FROM fitting_records WHERE id = ?').get(id) as any
    res.status(200).json({ success: true, data: updatedRecord })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update corrected values' })
  }
})

router.put('/:id/notes', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { content } = req.body

    if (content === undefined) {
      res.status(400).json({ success: false, error: 'content is required' })
      return
    }

    const db = getDb()

    const record = db.prepare('SELECT * FROM fitting_records WHERE id = ?').get(id) as any
    if (!record) {
      res.status(404).json({ success: false, error: 'Fitting record not found' })
      return
    }

    const currentNote = db.prepare('SELECT version FROM note_versions WHERE record_id = ? AND is_current = 1 ORDER BY version DESC LIMIT 1').get(id) as any

    db.prepare('UPDATE note_versions SET is_current = 0 WHERE record_id = ?').run(id)

    const nextVersion = currentNote ? currentNote.version + 1 : 1
    db.prepare(
      `INSERT INTO note_versions (id, record_id, content, version, is_current) VALUES (?, ?, ?, ?, 1)`
    ).run(uuidv4(), id, content, nextVersion)

    const notes = db.prepare('SELECT * FROM note_versions WHERE record_id = ? ORDER BY version').all(id) as any[]
    res.status(200).json({ success: true, data: notes })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update notes' })
  }
})

export default router
