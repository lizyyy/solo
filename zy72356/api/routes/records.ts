import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { importFromCsv, getRecords, getRecordById, reviewRecord, confirmRecord, rollbackRecord, getReport, getReportCsv } from '../services/recordService.js'
import type { RecordStatus } from '../types.js'
import { getAuditLogsByRecordId } from '../services/auditService.js'
import { addPhoto, getPhotosByRecordId } from '../services/photoService.js'

const router = Router()

const uploadDir = path.join(process.cwd(), 'uploads')

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const memoryStorage = multer.memoryStorage()

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    cb(null, `${uuidv4()}${ext}`)
  },
})

const csvUpload = multer({
  storage: memoryStorage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (ext === '.csv' || ext === '.xlsx' || ext === '.xls') {
      cb(null, true)
    } else {
      cb(new Error('仅支持 CSV/Excel 文件'))
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
})

const photoUpload = multer({
  storage: diskStorage,
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    if (['.jpg', '.jpeg', '.png', '.webp', '.bmp'].includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error('仅支持图片文件'))
    }
  },
  limits: { fileSize: 20 * 1024 * 1024 },
})

router.post('/records/import', csvUpload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: '请上传文件' })
      return
    }
    const result = await importFromCsv(req.file.buffer, req.file.originalname)
    res.json({
      success: true,
      data: {
        imported: result.batch.totalCount,
        mixed: result.batch.mixedCount,
        normal: result.batch.totalCount - result.batch.mixedCount,
        batch: result.batch,
        records: result.records,
      },
    })
  } catch (err: any) {
    console.error('Import error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/records', async (req: Request, res: Response) => {
  try {
    const { status, sensorId, page, pageSize } = req.query
    const result = await getRecords({
      status: status as RecordStatus | undefined,
      sensorId: sensorId as string | undefined,
      page: page ? parseInt(page as string) : undefined,
      pageSize: pageSize ? parseInt(pageSize as string) : undefined,
    })
    res.json({ success: true, data: result })
  } catch (err: any) {
    console.error('Get records error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/records/:id', async (req: Request, res: Response) => {
  try {
    const record = await getRecordById(req.params.id)
    if (!record) {
      res.status(404).json({ success: false, error: '记录不存在' })
      return
    }
    res.json({ success: true, data: record })
  } catch (err: any) {
    console.error('Get record error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.patch('/records/:id/review', async (req: Request, res: Response) => {
  try {
    const { credibility, correctedValue, correctedUnit, note, operatorRole } = req.body
    if (!credibility || !operatorRole) {
      res.status(400).json({ success: false, error: '缺少必要参数: credibility, operatorRole' })
      return
    }
    const record = await reviewRecord(req.params.id, {
      credibility,
      correctedValue: correctedValue != null ? parseFloat(correctedValue) : undefined,
      correctedUnit,
      note,
      operatorRole,
    })
    if (!record) {
      res.status(404).json({ success: false, error: '记录不存在' })
      return
    }
    res.json({ success: true, data: record })
  } catch (err: any) {
    console.error('Review error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.patch('/records/:id/confirm', async (req: Request, res: Response) => {
  try {
    const { operatorRole, note } = req.body
    if (!operatorRole) {
      res.status(400).json({ success: false, error: '缺少必要参数: operatorRole' })
      return
    }
    const record = await confirmRecord(req.params.id, operatorRole, note)
    if (!record) {
      res.status(404).json({ success: false, error: '记录不存在' })
      return
    }
    res.json({ success: true, data: record })
  } catch (err: any) {
    console.error('Confirm error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/records/:id/rollback', async (req: Request, res: Response) => {
  try {
    const { reason, operatorRole } = req.body
    if (!reason || !operatorRole) {
      res.status(400).json({ success: false, error: '缺少必要参数: reason, operatorRole' })
      return
    }
    const record = await rollbackRecord(req.params.id, reason, operatorRole)
    if (!record) {
      res.status(404).json({ success: false, error: '记录不存在' })
      return
    }
    res.json({ success: true, data: record })
  } catch (err: any) {
    console.error('Rollback error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/records/:id/audit-log', async (req: Request, res: Response) => {
  try {
    const logs = await getAuditLogsByRecordId(req.params.id)
    res.json({ success: true, data: logs })
  } catch (err: any) {
    console.error('Get audit log error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.post('/records/:id/photos', photoUpload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: '请上传图片' })
      return
    }
    const photo = await addPhoto(req.params.id, req.file.path, req.body.description || null)
    res.json({ success: true, data: photo })
  } catch (err: any) {
    console.error('Add photo error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/records/:id/photos', async (req: Request, res: Response) => {
  try {
    const photos = await getPhotosByRecordId(req.params.id)
    res.json({ success: true, data: photos })
  } catch (err: any) {
    console.error('Get photos error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/report', async (req: Request, res: Response) => {
  try {
    const report = await getReport()
    res.json({ success: true, data: report })
  } catch (err: any) {
    console.error('Get report error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

router.get('/report/export', async (req: Request, res: Response) => {
  try {
    const format = (req.query.format as string) || 'csv'
    if (format === 'csv') {
      const csv = await getReportCsv()
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename=wave-tank-report.csv')
      res.send('\uFEFF' + csv)
    } else {
      res.status(400).json({ success: false, error: '暂不支持该格式' })
    }
  } catch (err: any) {
    console.error('Export error:', err)
    res.status(500).json({ success: false, error: err.message })
  }
})

export default router
