import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs'
import { db } from '../db.js'

const router = Router()

const uploadsDir = path.resolve(process.cwd(), 'uploads')
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${uuidv4()}${ext}`)
  },
})

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/json' || path.extname(file.originalname) === '.json') {
      cb(null, true)
    } else {
      cb(new Error('仅支持JSON文件上传'))
    }
  },
})

function classifyRecord(record: Record<string, unknown>): { type: string; confidence: number } {
  if (record.isDuplicate === true) {
    return { type: 'duplicate', confidence: 0.85 }
  }
  if (record.correctionOf !== undefined && record.correctionOf !== null) {
    return { type: 'correction', confidence: 0.9 }
  }
  if (record.isLate === true) {
    return { type: 'late_arrival', confidence: 0.8 }
  }
  return { type: 'normal', confidence: 1.0 }
}

router.post('/', upload.single('file'), (req: Request, res: Response): void => {
  try {
    const file = req.file
    if (!file) {
      res.status(400).json({ success: false, error: '未上传文件' })
      return
    }

    const bundleId = uuidv4()
    const insertBundle = db.prepare(
      'INSERT INTO bundles (id, filename, status) VALUES (?, ?, ?)'
    )
    insertBundle.run(bundleId, file.originalname, 'parsing')

    const fileContent = fs.readFileSync(file.path, 'utf-8')
    let records: Record<string, unknown>[]

    try {
      const parsed = JSON.parse(fileContent)
      records = Array.isArray(parsed) ? parsed : [parsed]
    } catch {
      db.prepare('UPDATE bundles SET status = ? WHERE id = ?').run('error', bundleId)
      res.status(400).json({ success: false, error: 'JSON文件解析失败' })
      return
    }

    const insertRecord = db.prepare(
      'INSERT INTO records (id, bundle_id, type, raw_data, confidence) VALUES (?, ?, ?, ?, ?)'
    )

    const insertMany = db.transaction(() => {
      for (const record of records) {
        const { type, confidence } = classifyRecord(record)
        const recordId = uuidv4()
        insertRecord.run(recordId, bundleId, type, JSON.stringify(record), confidence)
      }
    })

    insertMany()

    db.prepare('UPDATE bundles SET status = ? WHERE id = ?').run('parsed', bundleId)

    const bundle = db.prepare('SELECT * FROM bundles WHERE id = ?').get(bundleId)
    const savedRecords = db.prepare('SELECT * FROM records WHERE bundle_id = ?').all(bundleId)

    res.status(201).json({
      success: true,
      data: { bundle, records: savedRecords },
    })
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器内部错误' })
  }
})

router.get('/', (_req: Request, res: Response): void => {
  try {
    const bundles = db.prepare('SELECT * FROM bundles ORDER BY uploaded_at DESC').all()
    res.json({ success: true, data: bundles })
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器内部错误' })
  }
})

router.get('/:id', (req: Request, res: Response): void => {
  try {
    const bundle = db.prepare('SELECT * FROM bundles WHERE id = ?').get(req.params.id)
    if (!bundle) {
      res.status(404).json({ success: false, error: '数据包不存在' })
      return
    }
    const records = db.prepare('SELECT * FROM records WHERE bundle_id = ?').all(req.params.id)
    res.json({ success: true, data: { bundle, records } })
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器内部错误' })
  }
})

router.post('/:id/confirm', (req: Request, res: Response): void => {
  try {
    const bundle = db.prepare('SELECT * FROM bundles WHERE id = ?').get(req.params.id) as { id: string; status: string } | undefined
    if (!bundle) {
      res.status(404).json({ success: false, error: '数据包不存在' })
      return
    }
    if (bundle.status === 'confirmed') {
      res.status(400).json({ success: false, error: '数据包已确认' })
      return
    }

    const records = db.prepare('SELECT * FROM records WHERE bundle_id = ?').all(req.params.id) as { id: string; type: string }[]

    if (records.length === 0) {
      res.status(400).json({ success: false, error: '数据包中没有记录' })
      return
    }

    const { modelId, date } = req.body
    if (!modelId || !date) {
      res.status(400).json({ success: false, error: '需要提供modelId和date参数' })
      return
    }

    const model = db.prepare('SELECT * FROM models WHERE id = ?').get(modelId)
    if (!model) {
      res.status(404).json({ success: false, error: '模型不存在' })
      return
    }

    const typeCounts: Record<string, number> = {}
    for (const r of records) {
      typeCounts[r.type] = (typeCounts[r.type] || 0) + 1
    }

    let severity = 'low'
    if (typeCounts['correction'] > 0 || (typeCounts['duplicate'] || 0) > 5) {
      severity = 'critical'
    } else if ((typeCounts['late_arrival'] || 0) > 3 || (typeCounts['duplicate'] || 0) > 2) {
      severity = 'high'
    } else if ((typeCounts['late_arrival'] || 0) > 0 || (typeCounts['duplicate'] || 0) > 0) {
      severity = 'medium'
    }

    const reportId = uuidv4()
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19)

    db.prepare(
      'INSERT INTO reports (id, date, model_id, severity, bundle_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(reportId, date, modelId, severity, req.params.id, now, now)

    db.prepare('UPDATE bundles SET status = ? WHERE id = ?').run('confirmed', req.params.id)

    const report = db.prepare('SELECT * FROM reports WHERE id = ?').get(reportId)
    res.status(201).json({ success: true, data: { report } })
  } catch (error) {
    res.status(500).json({ success: false, error: '服务器内部错误' })
  }
})

export default router
