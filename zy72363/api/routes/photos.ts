import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import db from '../db.js'
import type { PhotoMeta } from '../../shared/types.js'

const router = Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const uploadDir = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const sensorId = req.body.sensorId || 'unknown'
    const originalName = file.originalname
    const ext = path.extname(originalName)
    const baseName = path.basename(originalName, ext)
    const uniqueName = `${sensorId}_${baseName}_${Date.now()}${ext}`
    cb(null, uniqueName)
  },
})

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WebP)'))
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
})

router.post('/upload', upload.single('file'), async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' })
      return
    }

    const { sensorId, remark = '' } = req.body

    if (!sensorId) {
      fs.unlinkSync(req.file.path)
      res.status(400).json({ success: false, error: 'sensorId is required' })
      return
    }

    const sensor = db.prepare('SELECT * FROM sensor_data WHERE id = ?').get(sensorId)
    if (!sensor) {
      fs.unlinkSync(req.file.path)
      res.status(404).json({ success: false, error: 'Sensor not found' })
      return
    }

    const id = uuidv4()
    const filename = req.file.filename
    const url = `/uploads/${filename}`
    const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, '')

    db.prepare(
      'INSERT INTO photo_meta (id, sensor_id, filename, url, remark, uploaded_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, sensorId, filename, url, remark, now)

    const photo = db.prepare('SELECT * FROM photo_meta WHERE id = ?').get(id) as PhotoMeta

    res.status(200).json({
      success: true,
      data: photo,
    })
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path)
    }
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    })
  }
})

router.get('/:sensorId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sensorId } = req.params

    const sensor = db.prepare('SELECT * FROM sensor_data WHERE id = ?').get(sensorId)
    if (!sensor) {
      res.status(404).json({ success: false, error: 'Sensor not found' })
      return
    }

    const photos = db
      .prepare('SELECT * FROM photo_meta WHERE sensor_id = ? ORDER BY uploaded_at DESC')
      .all(sensorId) as PhotoMeta[]

    res.status(200).json({
      success: true,
      data: photos,
    })
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch photos',
    })
  }
})

export default router
