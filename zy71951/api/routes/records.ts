import { Router, type Request, type Response } from 'express'
import { getRecords, getRecordById, confirmRecordJudgment, addCorrection, createRecord } from '../services/recordService.js'
import { getRules } from '../services/judgmentService.js'

const router = Router()

router.get('/', (req: Request, res: Response): void => {
  const { page, pageSize, dateFrom, dateTo, towerId, status, anomalyType } = req.query

  const result = getRecords({
    page: page ? Number(page) : undefined,
    pageSize: pageSize ? Number(pageSize) : undefined,
    dateFrom: dateFrom as string | undefined,
    dateTo: dateTo as string | undefined,
    towerId: towerId as string | undefined,
    status: status as string | undefined,
    anomalyType: anomalyType as string | undefined,
  })

  res.json({ success: true, data: result })
})

router.get('/:id', (req: Request, res: Response): void => {
  const record = getRecordById(req.params.id)
  if (!record) {
    res.status(404).json({ success: false, error: '记录不存在' })
    return
  }
  res.json({ success: true, data: record })
})

router.post('/:id/confirm', (req: Request, res: Response): void => {
  const { judgmentId, confirmedBy } = req.body
  if (!judgmentId || !confirmedBy) {
    res.status(400).json({ success: false, error: '缺少judgmentId或confirmedBy' })
    return
  }

  const record = confirmRecordJudgment(req.params.id, judgmentId, confirmedBy)
  if (!record) {
    res.status(404).json({ success: false, error: '记录不存在' })
    return
  }

  res.json({ success: true, data: record })
})

router.post('/:id/correct', (req: Request, res: Response): void => {
  const { fieldName, newValue, reason, correctedBy } = req.body
  if (!fieldName || !newValue || !reason || !correctedBy) {
    res.status(400).json({ success: false, error: '缺少必填字段' })
    return
  }

  const record = addCorrection(req.params.id, { fieldName, newValue, reason, correctedBy })
  if (!record) {
    res.status(404).json({ success: false, error: '记录不存在' })
    return
  }

  res.json({ success: true, data: record })
})

router.get('/engine/rules', (_req: Request, res: Response): void => {
  const rules = getRules()
  res.json({ success: true, data: rules })
})

export default router
