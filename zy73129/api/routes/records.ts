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
  source_type: 'original' | 'retroactive_note'
  created_at: string
  updated_at: string
}

interface Annotation {
  id: string
  record_id: string
  annotator: string
  content: string
  annotation_time: string
  is_retroactive: number
}

router.get('/', (_req: Request, res: Response): void => {
  try {
    const records = db.prepare('SELECT * FROM survey_records ORDER BY created_at DESC').all() as SurveyRecord[]
    const annotations = db.prepare('SELECT * FROM annotations ORDER BY annotation_time DESC').all() as Annotation[]

    const annotationMap = new Map<string, Annotation[]>()
    for (const a of annotations) {
      if (!annotationMap.has(a.record_id)) {
        annotationMap.set(a.record_id, [])
      }
      annotationMap.get(a.record_id)!.push(a)
    }

    const result = records.map(r => ({
      ...r,
      annotations: annotationMap.get(r.id) || [],
    }))

    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch records' })
  }
})

router.post('/', (req: Request, res: Response): void => {
  try {
    const { site_name, latitude, longitude, sample_time, experiment_result, bleaching_level, source_type } = req.body

    if (!site_name || latitude == null || longitude == null || !sample_time || !experiment_result || bleaching_level == null || !source_type) {
      res.status(400).json({ success: false, error: 'Missing required fields' })
      return
    }

    if (!['original', 'retroactive_note'].includes(source_type)) {
      res.status(400).json({ success: false, error: 'source_type must be original or retroactive_note' })
      return
    }

    const id = crypto.randomUUID()
    const now = new Date().toISOString()

    db.prepare(`
      INSERT INTO survey_records (id, site_name, latitude, longitude, sample_time, experiment_result, bleaching_level, source_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, site_name, latitude, longitude, sample_time, experiment_result, bleaching_level, source_type, now, now)

    const record = db.prepare('SELECT * FROM survey_records WHERE id = ?').get(id) as SurveyRecord
    res.status(201).json({ success: true, data: record })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create record' })
  }
})

router.post('/:id/annotations', (req: Request, res: Response): void => {
  try {
    const { id } = req.params
    const { annotator, content, is_retroactive } = req.body

    const record = db.prepare('SELECT id FROM survey_records WHERE id = ?').get(id)
    if (!record) {
      res.status(404).json({ success: false, error: 'Record not found' })
      return
    }

    if (!annotator || !content) {
      res.status(400).json({ success: false, error: 'annotator and content are required' })
      return
    }

    const annotationId = crypto.randomUUID()
    const retroactive = is_retroactive ? 1 : 0

    db.prepare(`
      INSERT INTO annotations (id, record_id, annotator, content, is_retroactive)
      VALUES (?, ?, ?, ?, ?)
    `).run(annotationId, id, annotator, content, retroactive)

    const annotation = db.prepare('SELECT * FROM annotations WHERE id = ?').get(annotationId) as Annotation
    res.status(201).json({ success: true, data: annotation })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create annotation' })
  }
})

router.get('/mismatch', (_req: Request, res: Response): void => {
  try {
    const records = db.prepare('SELECT * FROM survey_records').all() as SurveyRecord[]

    const mismatches = records.filter(r => {
      const sampleMonth = r.sample_time.substring(0, 7)
      const resultMatch = r.experiment_result.match(/(\d{4}-\d{2})/)
      if (!resultMatch) return false
      return sampleMonth !== resultMatch[1]
    })

    res.json({ success: true, data: mismatches })
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to detect mismatches' })
  }
})

export default router
