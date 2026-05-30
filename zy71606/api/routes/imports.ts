import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import { uploadFiles, confirmImport, cancelImport, getImportStatus } from '../services/importService.js'

const router = Router()

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

router.post('/upload', upload.array('files', 10), (req: Request, res: Response): void => {
  const files = req.files as Express.Multer.File[]
  if (!files || files.length === 0) {
    res.status(400).json({ success: false, error: '请上传文件' })
    return
  }

  const result = uploadFiles(files)
  res.json({ success: true, data: result })
})

router.get('/:batchId/status', (req: Request, res: Response): void => {
  const { batchId } = req.params
  const result = getImportStatus(batchId)
  res.json({ success: true, data: result })
})

router.post('/:batchId/confirm', (req: Request, res: Response): void => {
  const { batchId } = req.params
  const result = confirmImport(batchId)
  res.json({ success: true, data: result })
})

router.delete('/:batchId/cancel', (req: Request, res: Response): void => {
  const { batchId } = req.params
  cancelImport(batchId)
  res.json({ success: true, data: { message: '批次已取消' } })
})

export default router
