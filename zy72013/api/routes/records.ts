import { Router, type Request, type Response } from 'express'
import multer from 'multer'
import path from 'path'
import { mkdirSync } from 'fs'
import { fileURLToPath } from 'url'
import * as recordService from '../services/recordService.js'
import * as attachmentRepo from '../repositories/attachmentRepository.js'
import { STATUS_LABELS, ATTACHMENT_TYPE_LABELS } from '../../shared/types.js'
import type { RecordStatus, AttachmentType } from '../../shared/types.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const uploadsDir = path.join(__dirname, '..', '..', 'uploads')
mkdirSync(uploadsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    const base = path.basename(file.originalname, ext)
    const unique = `${base}_${Date.now()}${ext}`
    cb(null, unique)
  },
})

const upload = multer({ storage })

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const filters = {
    status: req.query.status as string | undefined,
    min_amount: req.query.min_amount ? Number(req.query.min_amount) : undefined,
    max_amount: req.query.max_amount ? Number(req.query.max_amount) : undefined,
    start_date: req.query.start_date as string | undefined,
    end_date: req.query.end_date as string | undefined,
    keyword: req.query.keyword as string | undefined,
  }
  const result = recordService.listRecords(filters)
  res.json({ success: true, ...result })
})

router.get('/export', (req: Request, res: Response): void => {
  const filters = {
    status: req.query.status as string | undefined,
    min_amount: req.query.min_amount ? Number(req.query.min_amount) : undefined,
    max_amount: req.query.max_amount ? Number(req.query.max_amount) : undefined,
    start_date: req.query.start_date as string | undefined,
    end_date: req.query.end_date as string | undefined,
    keyword: req.query.keyword as string | undefined,
  }
  const records = recordService.exportRecords(filters)

  const headers = ['ID', '单位名称', '金额', '保证金类型', '状态', '来源', '原始备注', '创建时间', '更新时间']
  const rows = records.map(r => [
    r.id,
    r.unit_name,
    r.amount,
    r.deposit_type,
    STATUS_LABELS[r.status] || r.status,
    r.source,
    `"${(r.original_remark || '').replace(/"/g, '""')}"`,
    r.created_at,
    r.updated_at,
  ])

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const bom = '\uFEFF'
  const filename = `保证金退回记录_${new Date().toISOString().slice(0, 10)}.csv`

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`)
  res.send(bom + csvContent)
})

router.get('/:id', (req: Request, res: Response): void => {
  const result = recordService.getRecordDetail(req.params.id)
  if (!result) {
    res.status(404).json({ success: false, error: '记录不存在' })
    return
  }
  res.json({ success: true, ...result })
})

router.post('/', (req: Request, res: Response): void => {
  const { unit_name, amount, deposit_type, status, source, original_remark } = req.body
  if (!unit_name || amount === undefined) {
    res.status(400).json({ success: false, error: '单位名称和金额为必填项' })
    return
  }
  const record = recordService.createRecord({
    unit_name,
    amount: Number(amount),
    deposit_type,
    status: status as RecordStatus | undefined,
    source,
    original_remark,
  })
  res.status(201).json({ success: true, data: record })
})

router.put('/:id/rejudge', (req: Request, res: Response): void => {
  const { new_status, reason } = req.body
  if (!new_status || !reason) {
    res.status(400).json({ success: false, error: '新状态和原因为必填项' })
    return
  }
  const record = recordService.rejudgeRecord(req.params.id, { new_status: new_status as RecordStatus, reason })
  if (!record) {
    res.status(404).json({ success: false, error: '记录不存在' })
    return
  }
  res.json({ success: true, data: record })
})

router.put('/:id/rollback', (req: Request, res: Response): void => {
  const { reason } = req.body
  if (!reason) {
    res.status(400).json({ success: false, error: '原因为必填项' })
    return
  }
  const record = recordService.rollbackRecord(req.params.id, { reason })
  if (!record) {
    res.status(404).json({ success: false, error: '记录不存在或无法回滚' })
    return
  }
  res.json({ success: true, data: record })
})

router.post('/:id/supplement', (req: Request, res: Response): void => {
  const { remark } = req.body
  if (!remark) {
    res.status(400).json({ success: false, error: '备注内容为必填项' })
    return
  }
  const result = recordService.supplementRecord(req.params.id, { remark })
  if (!result) {
    res.status(404).json({ success: false, error: '记录不存在' })
    return
  }
  res.json({ success: true, ...result })
})

router.post('/:id/attachments', upload.single('file'), (req: Request, res: Response): void => {
  const file = req.file
  if (!file) {
    res.status(400).json({ success: false, error: '请上传文件' })
    return
  }
  const recordId = req.params.id
  const fileType = (req.body.file_type || 'other') as AttachmentType
  const originalRemark = req.body.original_remark || ''

  const attachment = attachmentRepo.create({
    record_id: recordId,
    file_name: file.originalname,
    file_type: fileType,
    original_remark: originalRemark,
    file_path: file.filename,
  })

  res.status(201).json({ success: true, data: attachment })
})

router.delete('/:id/attachments/:aid', (req: Request, res: Response): void => {
  const deleted = attachmentRepo.deleteById(req.params.id, req.params.aid)
  if (!deleted) {
    res.status(404).json({ success: false, error: '附件不存在' })
    return
  }
  res.json({ success: true })
})

export default router
