import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import { getImportJobsByBatch, getImportJobById } from '../repositories/import-job.repo.js'
import { processUploadedFile, mapFields, confirmImport } from '../services/import.service.js'

const upload = multer({
  dest: './uploads/tmp',
  limits: { fileSize: 50 * 1024 * 1024 },
})

const router = Router()

router.post('/:batchId/import', upload.single('file'), (req: Request, res: Response): void => {
  try {
    const file = req.file
    if (!file) {
      res.status(400).json({ success: false, error: '请上传文件' })
      return
    }
    const { batchId } = req.params
    const sourceType = req.body.sourceType || 'street_table'
    const result = processUploadedFile(file.path, file.originalname, sourceType, batchId)
    res.status(201).json({ success: true, data: result })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/:batchId/imports', (req: Request, res: Response): void => {
  try {
    const jobs = getImportJobsByBatch(req.params.batchId)
    res.json({ success: true, data: jobs })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.get('/:id/preview', (req: Request, res: Response): void => {
  try {
    const job = getImportJobById(req.params.id)
    if (!job) {
      res.status(404).json({ success: false, error: '导入任务不存在' })
      return
    }
    res.json({ success: true, data: { preview: job.rawPreview, fieldMapping: job.fieldMapping, recordCount: job.recordCount } })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.put('/:id/mapping', (req: Request, res: Response): void => {
  try {
    const { fieldMapping } = req.body
    if (!fieldMapping) {
      res.status(400).json({ success: false, error: '字段映射不能为空' })
      return
    }
    const result = mapFields(req.params.id, fieldMapping)
    res.json({ success: true, data: result })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

router.post('/:id/confirm', (req: Request, res: Response): void => {
  try {
    const actor = req.body.actor || 'system'
    const result = confirmImport(req.params.id, actor)
    res.json({ success: true, data: result })
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message })
  }
})

export default router
