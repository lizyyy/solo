import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import { parseImportData, createImportBatch, confirmImport, getImportBatch, getImportItems } from '../services/importService.js'

const upload = multer({ dest: 'uploads/' })

const router = Router()

router.post('/upload', upload.single('file'), (req: Request, res: Response): void => {
  try {
    let records: Record<string, unknown>[] = []

    if (req.body.records) {
      records = Array.isArray(req.body.records) ? req.body.records : [req.body.records]
    } else if (req.body) {
      records = Array.isArray(req.body) ? req.body : [req.body]
    }

    if (records.length === 0) {
      res.status(400).json({ success: false, error: '无有效数据' })
      return
    }

    const parsed = parseImportData(records)
    const batchName = req.file?.originalname ?? `batch-${Date.now()}`
    const importedBy = (req.body.importedBy as string) ?? 'anonymous'

    const result = createImportBatch(batchName, importedBy, parsed)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.post('/confirm', (req: Request, res: Response): void => {
  try {
    const { batchId, decisions } = req.body
    if (!batchId) {
      res.status(400).json({ success: false, error: '缺少batchId' })
      return
    }

    const actor = (req.body.actor as string) ?? 'system'
    const result = confirmImport({ batchId, decisions: decisions ?? [] }, actor)
    res.json({ success: true, data: result })
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message })
  }
})

router.get('/batch/:batchId', (req: Request, res: Response): void => {
  const batch = getImportBatch(req.params.batchId)
  if (!batch) {
    res.status(404).json({ success: false, error: '批次不存在' })
    return
  }

  const items = getImportItems(req.params.batchId)
  res.json({ success: true, data: { batch, items } })
})

export default router
